import logger from 'loglevel';
import { SQS } from 'aws-sdk';
import { CronJob } from 'cron';

import InstancesHelper from 'Helpers/instancesHelper';
import CloudWatchHelper from 'Helpers/cloudWatchHelper';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function getClusterMetrics() {
  const activeInstancesIds = [];

  const startTime = Date.now() - (30 * 60000); // 10 minutes ago

  logger.info('Fetching cluster metrics', { startTime: new Date(startTime) });

  const messages = await CloudWatchHelper.getLogMessages({
    filterPattern: '{ ($.instanceId != "local") && ($.averageMessageServiceTime = *)}',
    startTime,
  });

  const averageClusterServiceTimeAccumulator = messages.reduce(
    function(time, { instanceId, averageMessageServiceTime }) {
      if(!activeInstancesIds.includes(instanceId)) activeInstancesIds.push(instanceId);

      return time + averageMessageServiceTime;
    },
    0
  );

  return {
    averageClusterServiceTime: averageClusterServiceTimeAccumulator / messages.length,
    clusterSize: activeInstancesIds.length,
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
* @param {String} event.instanceType - Type of instances to create on orchestrator
* @param {Number} event.parallelProcessingCapacity - Number indicating how many messages one instance can handle in parallel
* @param {Number} event.maximumClusterSize - Maximum number of instances on cluster
* @param {String} [event.privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem'] - String indicating path to EC2 privateKey
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    sla,
    instanceType,
    parallelProcessingCapacity,
    privateKey,
    maximumClusterSize,
  } = event;

  const cron = `0/${Math.ceil((sla / 1000) / 4)} * * * * *`; // runs every sla / 4 milliseconds

  logger.info('Started orchestration function', { sla, instanceType, parallelProcessingCapacity, cron });

  const job = new CronJob(
    cron,
    async function() {
      logger.info('Started verification function', { startedAt: new Date() });

      const approximateNumberOfMessages = await getApproximateNumberOfMessages();
      const { averageClusterServiceTime, clusterSize: actualClusterSize } = await getClusterMetrics(this.lastDate().getTime());

      logger.info('Fetched approximate number of messages and service time', { approximateNumberOfMessages, averageClusterServiceTime });

      const idealClusterSize = Math.ceil((approximateNumberOfMessages * averageClusterServiceTime) / (sla * parallelProcessingCapacity));

      const newClusterSize = Math.min(maximumClusterSize, idealClusterSize);

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
              await InstancesHelper.startQueueConsumeOnInstance({ instanceId, privateKey });

              logger.info('Machine started consuming queue', { instanceId });
            } else {
              logger.warn('Instance failed creation', { instanceStatus });
            }
          }
        );

        Promise.all(startCrawlPromises);
      } else if (newClusterSize < actualClusterSize) {
        await InstancesHelper.terminateInstances({ numberOfInstances: actualClusterSize - newClusterSize });
      }

      return true;
    }
  );

  job.start();
};
