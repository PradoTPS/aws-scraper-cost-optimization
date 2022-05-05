import logger from 'loglevel';
import { SQS } from 'aws-sdk';
import { CronJob } from 'cron';

import InstancesHelper from 'Helpers/instancesHelper';
import CloudWatchHelper from 'Helpers/cloudWatchHelper';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function getClusterMetrics(lastExecutionTime) {
  const activeInstancesIds = [];

  const messages = await CloudWatchHelper.getLogMessages({
    filterPattern: '{ ($.instanceId != "local") && ($.averageMessageServiceTime = *) }',
    startTime: lastExecutionTime,
  });

  const averageClusterServiceTimeAccumulator = messages.reduce(
    function(time, { instanceId, averageMessageServiceTime }) {
      time += averageMessageServiceTime;

      if(!activeInstancesIds.includes(instanceId)) activeInstancesIds.push(instanceId);

      return time;
    },
    0,
  );

  return {
    averageClusterServiceTimeAccumulator,
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
* @command sls invoke local -f OrchestrateInstances -p tests/events/orchestrateInstances.json
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    sla,
    instanceType,
    parallelProcessingCapacity,
  } = event;

  const cron = `0/${Math.ceil((sla / 1000) / 4)} * * * * *`; // runs every sla / 4 milliseconds

  logger.info('Started orchestration function', { sla, instanceType, parallelProcessingCapacity, cron });

  const job = new CronJob(
    cron,
    async function() {
      logger.info('Started verification function', { startedAt: new Date() });

      const approximateNumberOfMessages = await getApproximateNumberOfMessages();
      const { averageClusterServiceTimeAccumulator, clusterSize: actualClusterSize } = await getClusterMetrics(this.lastDate().getTime());

      const averageClusterServiceTime = averageClusterServiceTimeAccumulator / actualClusterSize;

      logger.info('Fetched approximate number of messages and service time', { approximateNumberOfMessages, averageClusterServiceTime });

      const idealClusterSize = Math.ceil((approximateNumberOfMessages * averageClusterServiceTime) / (sla * parallelProcessingCapacity));

      logger.info('Fetched ideal numberOfInstances', { idealClusterSize, actualClusterSize });

      if (idealClusterSize > actualClusterSize) {
        await InstancesHelper.createInstances({ numberOfInstances: idealClusterSize - actualClusterSize, instanceType });
      } else if (idealClusterSize < actualClusterSize) {
        await InstancesHelper.terminateInstances({ numberOfInstances: actualClusterSize - idealClusterSize });
      }

      return true;
    }
  );

  job.start();
};
