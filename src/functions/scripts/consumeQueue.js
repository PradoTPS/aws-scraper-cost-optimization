import logger from 'loglevel';
import { SQS } from 'aws-sdk';

import sleep from 'Utils/sleep';
import getInstanceId from 'Utils/getInstanceId';
import CloudWatchHelper from 'Helpers/cloudWatchHelper';
import { main as startScrapingBatch } from 'Functions/startScrapingBatch';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function processMessages(messages, { cloudWatchHelper, instanceId }) {
  try {
    logger.info('Starting scrap process, creating log stream');

    const messagesBodies = messages.map(
      ({ Body, ReceiptHandle, Attributes: { ApproximateFirstReceiveTimestamp } }) =>
        ({ tags: { ReceiptHandle }, firstReceivedAt: ApproximateFirstReceiveTimestamp, ...JSON.parse(Body) })
      );

    const results = await startScrapingBatch({ entries: messagesBodies });

    logger.info('Scrap process finished, deleting messages');

    for (const result of results) {
      const { ReceiptHandle } = result.tags;

      if (result.success) {
        logger.info('Successfully scraped message, deleting from queue', { ReceiptHandle });

        await sqs.deleteMessage({ QueueUrl: process.env.SCRAPING_QUEUE_URL, ReceiptHandle }).promise();
      } else {
        logger.info('Couldn\'t scrap message, , message will return to queue after timeout', { ReceiptHandle });
      }
    }

    const processedResults = results.filter((result) => result.success);

    const totalMessageProcessingTime = processedResults.reduce((total, { processingTime }) => total + processingTime, 0);
    const totalMessageServiceTime = processedResults.reduce((total, { serviceTime }) => total + serviceTime, 0);

    const averageMessageProcessingTimeOnBatch = totalMessageProcessingTime / processedResults.length;
    const averageMessageServiceTimeOnBatch = totalMessageServiceTime / processedResults.length;

    const totalMessageProcessingTimeDeviation = processedResults.reduce((total, { processingTime }) => total + (processingTime - averageMessageProcessingTimeOnBatch) ^ 2, 0);

    const messageProcessingTimeVarianceOnBatch = totalMessageProcessingTimeDeviation / processedResults.length;

    console.log({
      totalMessageProcessingTime,
      totalMessageServiceTime,
      averageMessageProcessingTimeOnBatch,
      averageMessageServiceTimeOnBatch,
      totalMessageProcessingTimeDeviation,
      messageProcessingTimeVarianceOnBatch,
    });

    await cloudWatchHelper.logAndRegisterMessage(
      JSON.stringify({
        message: 'Messages successfully processed',
        type: 'batchMetrics',
        instanceId,
        averageMessageProcessingTimeOnBatch,
        averageMessageServiceTimeOnBatch,
        messageProcessingTimeVarianceOnBatch,
      })
    );

    return { averageMessageProcessingTimeOnBatch, averageMessageServiceTimeOnBatch, messageProcessingTimeVarianceOnBatch };
  } catch (error) {
    logger.error('Couldn\'t start scrap process, messages will return to queue after timeout', { error });
  }
}

/**
* @description Script function responsible for consuming ScrapingQueue and running scraper
* @param {Object} event - Base lambda event
* @param {Number} event.readBatchSize - Integer size indicating the number of messages to be read by batch
* @command sls invoke local -f ConsumeQueue -p tests/events/consumeQueue.json
*/
export async function main (event) {
  logger.setLevel('info');

  let processedBatches = 0;
  let averageMessageProcessingTimeAccumulator = 0;
  let messageProcessingTimeVarianceAccumulator = 0;
  let averageMessageServiceTimeAccumulator = 0;

  const {
    readBatchSize,
  } = event;

  const instanceId = await getInstanceId();

  const cloudWatchHelper = new CloudWatchHelper();

  const logStreamName = `consume-queue-execution_${Date.now()}_${instanceId}`;

  await cloudWatchHelper.initializeLogStream(logStreamName);

  logger.info('Log stream created, starting consumption', { readBatchSize, logStreamName });

  while (true) {
    let Messages = [];
    let numberOfReads = 0;

    // tries to match readBatchSize 3 times, if cannot match it use fetched
    while (Messages.length < readBatchSize && numberOfReads < 3) {
      const params = {
        QueueUrl: process.env.SCRAPING_QUEUE_URL,
        MaxNumberOfMessages: readBatchSize < 10 ? readBatchSize : 10,
        AttributeNames: ['ApproximateFirstReceiveTimestamp'] // if is smaller then maximum use it, else use SQS maximum per read (10)
      };

      logger.info('Fetching messages', { params });

      const { Messages: NewMessages = [] } = await sqs.receiveMessage(params).promise();

      Messages = Messages.concat(NewMessages);
      numberOfReads += 1;
    };

    if (Messages.length) {
      logger.info('Fetched messages', { messagesNumber: Messages.length });

      const {
        averageMessageProcessingTimeOnBatch,
        averageMessageServiceTimeOnBatch,
        messageProcessingTimeVarianceOnBatch,
      } = await processMessages(Messages, { cloudWatchHelper, instanceId });

      processedBatches += 1;

      messageProcessingTimeVarianceAccumulator += messageProcessingTimeVarianceOnBatch;
      averageMessageProcessingTimeAccumulator += averageMessageProcessingTimeOnBatch;
      averageMessageServiceTimeAccumulator += averageMessageServiceTimeOnBatch;

      const averageMessageProcessingTime = averageMessageProcessingTimeAccumulator / processedBatches;
      const averageMessageServiceTime = averageMessageServiceTimeAccumulator / processedBatches;
      const messageProcessingTimeVariance = messageProcessingTimeVarianceAccumulator / processedBatches;

      await cloudWatchHelper.logAndRegisterMessage(
        JSON.stringify(
          {
            message: 'Current execution metrics',
            type: 'instanceMetrics',
            instanceId,
            processedBatches,
            averageMessageProcessingTimeAccumulator,
            averageMessageProcessingTime,
            averageMessageServiceTime,
            messageProcessingTimeVariance,
          }
        ),
      );
    } else {
      logger.info('Queue is empty, waiting to try again', { messagesNumber: Messages.length });

      await sleep(60000); // 1 minute
    }
  }
};