import logger from 'loglevel';
import { SQS } from 'aws-sdk';

import sleep from 'Utils/sleep';
import { main as startScrapingBatch } from 'Functions/startScrapingBatch';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function processMessages(messages) {
  try {
    logger.info('Starting scrap proccess');

    let messageProcessingTimeAccumulator = 0;

    const messagesBodies = messages.map(({ Body, ReceiptHandle }) => ({ tags: { ReceiptHandle }, ...JSON.parse(Body) }));

    const results = await startScrapingBatch({ entries: messagesBodies });

    logger.info('Scrap proccess finished, deleting messages');

    for (const result of results) {
      const { ReceiptHandle } = result.tags;

      if (result.success) {
        logger.info('Successfully scraped message, deleting form queue', { ReceiptHandle });

        messageProcessingTimeAccumulator += result.processingTime;

        await sqs.deleteMessage({ QueueUrl: process.env.SCRAPING_QUEUE_URL, ReceiptHandle }).promise();
      } else {
        logger.info('Couldn\'t scrap message, , message will return to queue after timeout', { ReceiptHandle });
      }
    }

    const processedMessages = results.reduce((successfullResults, result) => result.success ? successfullResults + 1 : successfullResults, 0);

    const averageMessageProcessingTimeOnBatch = messageProcessingTimeAccumulator / processedMessages;

    logger.info('Messages successfully processed', { processedMessages, messageProcessingTimeAccumulator, averageMessageProcessingTimeOnBatch });

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

  logger.info('Starting consumption', { readBatchSize });

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

      const averageMessageProcessingTimeOnBatch = await processMessages(Messages);

      processedBatches += 1;
      averageMessageProcessingTimeAccumulator += averageMessageProcessingTimeOnBatch;

      const averageMessageProcessingTime = averageMessageProcessingTimeAccumulator / processedBatches;

      logger.info('Current average message processing time', { processedBatches, averageMessageProcessingTimeAccumulator, averageMessageProcessingTime });
    } else {
      logger.info('Queue is empty, waiting to try again', { messagesNumber: Messages.length });

      await sleep(60000); // 1 minute
    }
  }
};