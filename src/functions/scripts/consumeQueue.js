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

    let messageProcessingTimeAccumulator = 0;

    const messagesBodies = messages.map(({ Body, ReceiptHandle }) => ({ tags: { ReceiptHandle }, ...JSON.parse(Body) }));

    const results = await startScrapingBatch({ entries: messagesBodies });

    logger.info('Scrap process finished, deleting messages');

    for (const result of results) {
      const { ReceiptHandle } = result.tags;

      if (result.success) {
        logger.info('Successfully scraped message, deleting from queue', { ReceiptHandle });

        messageProcessingTimeAccumulator += result.processingTime;

        await sqs.deleteMessage({ QueueUrl: process.env.SCRAPING_QUEUE_URL, ReceiptHandle }).promise();
      } else {
        logger.info('Couldn\'t scrap message, , message will return to queue after timeout', { ReceiptHandle });
      }
    }

    const processedMessages = results.reduce((successfulResults, result) => result.success ? successfulResults + 1 : successfulResults, 0);

    const averageMessageProcessingTimeOnBatch = messageProcessingTimeAccumulator / processedMessages;

    await cloudWatchHelper.logAndRegisterMessage(
      JSON.stringify({
        message: 'Messages successfully processed',
        type: 'batchMetrics',
        instanceId,
        processedMessages,
        messageProcessingTimeAccumulator,
        averageMessageProcessingTimeOnBatch
      })
    );

    return averageMessageProcessingTimeOnBatch;
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
        MaxNumberOfMessages: readBatchSize < 10 ? readBatchSize : 10 // if is smaller then maximum use it, else use SQS maximum per read (10)
      };

      logger.info('Fetching messages', { params });

      const { Messages: NewMessages = [] } = await sqs.receiveMessage(params).promise();

      Messages = Messages.concat(NewMessages);
      numberOfReads += 1;
    };

    if (Messages.length) {
      logger.info('Fetched messages', { messagesNumber: Messages.length });

      const averageMessageProcessingTimeOnBatch = await processMessages(Messages, { cloudWatchHelper, instanceId });

      processedBatches += 1;
      averageMessageProcessingTimeAccumulator += averageMessageProcessingTimeOnBatch;

      const averageMessageProcessingTime = averageMessageProcessingTimeAccumulator / processedBatches;

      await cloudWatchHelper.logAndRegisterMessage(
        JSON.stringify(
          {
            message: 'Current average message processing time',
            type: 'instanceMetrics',
            instanceId,
            processedBatches,
            averageMessageProcessingTimeAccumulator,
            averageMessageProcessingTime
          }
        ),
      );
    } else {
      logger.info('Queue is empty, waiting to try again', { messagesNumber: Messages.length });

      await sleep(60000); // 1 minute
    }
  }
};