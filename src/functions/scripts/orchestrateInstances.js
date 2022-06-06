import logger from 'loglevel';

import { SQS } from 'aws-sdk';
import { CronJob } from 'cron';

import sleep from 'Utils/sleep';
import writeJson from 'Utils/writeJson';
import generateLineChart from 'Utils/generateLineChart';

import ec2Pricing from 'Constants/ec2Pricing';

import InstancesHelper from 'Helpers/instancesHelper';
import CloudWatchHelper from 'Helpers/cloudWatchHelper';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function getClusterMetrics({ startTime }) {
  logger.info('Fetching cluster metrics', { startTime: new Date(startTime) });

  const messages = await CloudWatchHelper.getLogMessages({
    filterPattern: '{ ($.instanceId != "local") && ($.averageMessageServiceTime = *) && ($.averageMessageProcessingTime = *)}',
    startTime,
  });

  const [
    averageClusterServiceTimeAccumulator,
    averageClusterProcessingTimeAccumulator,
  ] = messages.reduce(
    function(
      [averageMessageServiceTimeAccumulator, averageMessageProcessingTimeAccumulator],
      { averageMessageServiceTime, averageMessageProcessingTime }
    ) {
      return [
        averageMessageServiceTimeAccumulator + averageMessageServiceTime,
        averageMessageProcessingTimeAccumulator + averageMessageProcessingTime,
      ];
    },
    [0, 0],
  );

  const averageClusterServiceTime = averageClusterServiceTimeAccumulator / messages.length;
  const averageClusterProcessingTime = averageClusterProcessingTimeAccumulator / messages.length;

  return {
    averageClusterServiceTime,
    averageClusterProcessingTime,
  };
}

async function getApproximateNumberOfMessages() {
  const {
    Attributes: {
      ApproximateNumberOfMessages: approximateNumberOfMessages
    },
  } = await sqs.getQueueAttributes({
    QueueUrl: process.env.SCRAPING_QUEUE_URL,
    AttributeNames: ['ApproximateNumberOfMessages']
  }).promise();

  return parseInt(approximateNumberOfMessages);
}

/**
* @description Script function responsible for orchestrating instances
* @param {Object} event - Base lambda event
* @param {Number} event.sla - Integer size indicating the SLA (Service Level Agreement) time in milliseconds
* @param {Number} event.parallelProcessingCapacity - Number indicating how many messages one instance can handle in parallel
* @param {Number} event.maximumClusterSize - Maximum number of instances on cluster
* @param {String} [event.instanceType ='t2.small'] - Type of instances to create on orchestrator
* @param {String} resultsPath - Path where execution results will be saved
* @param {String} [event.privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem'] - String indicating path to EC2 privateKey
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    sla,
    instanceType =  't2.small',
    parallelProcessingCapacity,
    privateKey,
    resultsPath,
    maximumClusterSize,
  } = event;

  let currentCost = 0;
  let currentIteration = 0;

  const startTime = Date.now();

  const clusterSizeRecords = []; // initial values will be added on first iteration
  const creditBalanceRecords = []; // initial values will be added on first iteration

  const processingTimeRecords = [[0, 0]];
  const approximateNumberOfMessagesRecords = [[0, 0]];

  const cronInterval = Math.ceil(sla / 4);
  const cronIntervalInSeconds = Math.ceil(cronInterval / 1000);

  const cron = `0/${cronIntervalInSeconds} * * * * *`; // runs every sla / 4 seconds

  logger.info('Started orchestration function', { sla, instanceType, parallelProcessingCapacity, cron });

  const job = new CronJob(
    cron,
    async function() {
      const clusterInstances = await InstancesHelper.getInstances({
        filters: [
          {
            Name: 'instance-state-name',
            Values: ['running', 'pending']
          },
        ],
      });

      const burstableInstanceId = clusterInstances.find((instance) => instance.InstanceType.includes('t3')).InstanceId;

      const currentCreditBalance = await CloudWatchHelper.getLastMetric({
        metricDataQuery: {
          Id: 'cpuCreditBalance',
          MetricStat: {
            Metric: {
              Dimensions: [
                {
                  Name: 'InstanceId',
                  Value:  burstableInstanceId
                },
              ],
              MetricName: 'CPUCreditBalance',
              Namespace: 'AWS/EC2'
            },
            Period: 60,
            Stat: 'Maximum',
          },
        }
      });

      if (currentIteration > 0) {
        const activeInstanceTypes = clusterInstances.map((instance) => instance.InstanceType);

        for (const activeInstanceType of activeInstanceTypes) currentCost += (ec2Pricing[activeInstanceType] / 3600) * cronIntervalInSeconds;
      } else {
        clusterSizeRecords.push([clusterInstances.length, 0]);
        creditBalanceRecords.push([currentCreditBalance, 0]);
      }

      logger.info('Started verification function', { startedAt: new Date(), currentIteration, currentCost });

      const approximateNumberOfMessages = await getApproximateNumberOfMessages();

      let {
        averageClusterServiceTime,
        averageClusterProcessingTime,
      } = await getClusterMetrics({ startTime });

      // 30 sec, default value if system recently started running
      averageClusterServiceTime = averageClusterServiceTime || 20000;
      const queueName = process.env.SCRAPING_QUEUE_URL.split('/').pop();

      const approximateAgeOfOldestMessageInSeconds = await CloudWatchHelper.getLastMetric({
        metricDataQuery: {
          Id: 'approximateAgeOfOldestMessage',
          MetricStat: {
            Metric: {
              Dimensions: [
                {
                  Name: 'QueueName',
                  Value:  queueName
                },
              ],
              MetricName: 'ApproximateAgeOfOldestMessage',
              Namespace: 'AWS/SQS'
            },
            Period: 60,
            Stat: 'Maximum',
          },
        }
      });

      const approximateAgeOfOldestMessage = approximateAgeOfOldestMessageInSeconds * 1000;

      logger.info(
        'Fetched approximate number of messages, age of oldest message and average service time',
        {
          approximateNumberOfMessages,
          approximateAgeOfOldestMessage,
          averageClusterServiceTime,
          averageClusterProcessingTime,
          currentCreditBalance,
        }
      );

      if (approximateNumberOfMessages) {
        const idealClusterSize = Math.ceil((approximateNumberOfMessages * averageClusterServiceTime) / (sla * parallelProcessingCapacity));

        const newClusterSize = Math.min(maximumClusterSize, idealClusterSize);

        const actualClusterSize = clusterInstances.length;

        logger.info('Fetched ideal numberOfInstances', { idealClusterSize, actualClusterSize, newClusterSize });

        if (newClusterSize > actualClusterSize) {
          const newInstances = await InstancesHelper.createInstances({
            numberOfInstances: newClusterSize - actualClusterSize,
            instanceType
          });

          const startCrawlPromises = newInstances.map(
            async ({ instanceId }) => {
              const instanceStatus = await InstancesHelper.waitInstanceFinalStatus({ instanceId });

              if (instanceStatus === 'running') {
                await sleep(40000); // 40 sec, wait after status changes to running

                await InstancesHelper.startQueueConsumeOnInstance({ instanceId, privateKey, readBatchSize: parallelProcessingCapacity });
              } else {
                logger.warn('Instance failed creation', { instanceStatus });
              }
            }
          );

          Promise.all(startCrawlPromises);
        } else if (newClusterSize < actualClusterSize) {
          if (approximateAgeOfOldestMessage < sla) {
            await InstancesHelper.terminateInstances({ numberOfInstances: actualClusterSize - newClusterSize });
          } else {
            logger.warn('Will not reduce cluster because oldest message is greater then SLA', { approximateAgeOfOldestMessage, sla });
          }
        }

        const currentTimestamp = (currentIteration + 1) * cronIntervalInSeconds;

        // Update metric records
        clusterSizeRecords.push([newClusterSize, currentTimestamp]);
        creditBalanceRecords.push([currentCreditBalance, currentTimestamp]);
        processingTimeRecords.push([averageClusterProcessingTime / 1000, currentTimestamp]);
        approximateNumberOfMessagesRecords.push([approximateNumberOfMessages, currentTimestamp]);

        currentIteration += 1;
      } else {
        const resultLabel = Date.now();

        const clusterAverageProcessingTimeVariance = processingTimeRecords.reduce(
          (accumulator, [processingTime]) => processingTime > 0
                                              ? accumulator + ((processingTime - averageClusterProcessingTime) ^ 2)
                                              : accumulator,
          0,
        ) / processingTimeRecords.length;

        generateLineChart({
          data: clusterSizeRecords.map(([x, _]) => x),
          labels: clusterSizeRecords.map(([_, y]) => y),
          path: resultsPath,
          fileName: `cluster_size_${resultLabel}.jpg`,
          lineLabel: 'Tamanho do Cluster x Tempo (s)',
        });

        generateLineChart({
          data: processingTimeRecords.map(([x, _]) => x),
          labels: processingTimeRecords.map(([_, y]) => y),
          path: resultsPath,
          fileName: `processing_time_${resultLabel}.jpg`,
          lineLabel: 'Tempo de médio processamento (s) x Tempo (s)'
        });

        generateLineChart({
          data: approximateNumberOfMessagesRecords.map(([x, _]) => x),
          labels: approximateNumberOfMessagesRecords.map(([_, y]) => y),
          path: resultsPath,
          fileName: `approximate_number_of_messages_${resultLabel}.jpg`,
          lineLabel: 'Número aproximado de mensagens x Tempo (s)'
        });

        generateLineChart({
          data: creditBalanceRecords.map(([x, _]) => x),
          labels: creditBalanceRecords.map(([_, y]) => y),
          path: resultsPath,
          fileName: `credit_balance_${resultLabel}.jpg`,
          lineLabel: 'Créditos de CPU x Tempo (s)'
        });

        writeJson({
          data:{
            averageClusterServiceTime,
            averageClusterProcessingTime,
            clusterAverageProcessingTimeVariance,

            clusterSizeRecords,
            processingTimeRecords,
            approximateNumberOfMessagesRecords,
            creditBalanceRecords,
          },
          path: resultsPath,
          fileName: `execution_data_${resultLabel}.json`,
        });

        this.stop();
      }

      return true;
    }
  );

  job.start();
};
