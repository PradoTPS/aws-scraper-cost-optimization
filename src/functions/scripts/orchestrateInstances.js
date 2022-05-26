import logger from 'loglevel';
import { SQS } from 'aws-sdk';
import { CronJob } from 'cron';

import sleep from 'Utils/sleep';

import ec2Pricing from 'Constants/ec2Pricing';

import InstancesHelper from 'Helpers/instancesHelper';
import CloudWatchHelper from 'Helpers/cloudWatchHelper';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function getClusterMetrics() {
  const startTime = Date.now() - (30 * 60000); // 10 minutes ago

  logger.info('Fetching cluster metrics', { startTime: new Date(startTime) });

  const messages = await CloudWatchHelper.getLogMessages({
    filterPattern: '{ ($.instanceId != "local") && ($.averageMessageServiceTime = *) && ($.averageMessageProcessingTime = *)}',
    startTime,
  });

  const [averageClusterServiceTimeAccumulator, averageClusterProcessingTimeAccumulator] = messages.reduce(
    function(
      [averageMessageServiceTimeAccumulator, averageMessageProcessingTimeAccumulator],
      { averageMessageServiceTime, averageMessageProcessingTime }
    ) {
      return [averageMessageServiceTimeAccumulator + averageMessageServiceTime, averageMessageProcessingTimeAccumulator + averageMessageProcessingTime];
    },
    [0, 0],
  );

  return {
    averageClusterServiceTime: averageClusterServiceTimeAccumulator / messages.length,
    averageClusterProcessingTime: averageClusterProcessingTimeAccumulator / messages.length,
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

  return approximateNumberOfMessages;
}

/**
* @description Script function responsible for orchestrating instances
* @param {Object} event - Base lambda event
* @param {Number} event.sla - Integer size indicating the SLA (Service Level Agreement) time in milliseconds
* @param {Number} event.parallelProcessingCapacity - Number indicating how many messages one instance can handle in parallel
* @param {Number} event.maximumClusterSize - Maximum number of instances on cluster
* @param {String} [event.instanceType ='t2.small'] - Type of instances to create on orchestrator
* @param {String} [event.privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem'] - String indicating path to EC2 privateKey
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    sla,
    instanceType =  't2.small',
    parallelProcessingCapacity,
    privateKey,
    maximumClusterSize,
  } = event;

  let currentCost = 0;
  let currentIteration = 0;

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

      if (currentIteration > 0) {
        const activeInstanceTypes = clusterInstances.map((instance) => instance.InstanceType);

        for (const activeInstanceType of activeInstanceTypes) currentCost += (ec2Pricing[activeInstanceType] / 3600) * cronIntervalInSeconds;
      }

      logger.info('Started verification function', { startedAt: new Date(), currentIteration, currentCost });

      const approximateNumberOfMessages = await getApproximateNumberOfMessages();

      let { averageClusterServiceTime, averageClusterProcessingTime } = await getClusterMetrics();

      // 30 sec, default value if system recently started running
      averageClusterServiceTime = averageClusterServiceTime || 30000;
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

      logger.info('Fetched approximate number of messages, age of oldest message and average service time', { approximateNumberOfMessages, approximateAgeOfOldestMessage, averageClusterServiceTime, averageClusterProcessingTime });

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
              await sleep(30000); // 30 sec, wait after status changes to running

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

      currentIteration+=1;

      return true;
    }
  );

  job.start();
};
