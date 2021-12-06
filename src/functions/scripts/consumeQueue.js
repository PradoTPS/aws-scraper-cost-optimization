import logger from 'loglevel';
import { SQS } from 'aws-sdk';

import sleep from 'Utils/sleep';
import { main as startScrapingBatch } from 'Functions/startScrapingBatch';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function processMessages(messages) {
  try {
    logger.info('Starting scrap proccess');

    const messagesBodies = messages.map(({ Body, ReceiptHandle }) => ({ tags: { ReceiptHandle }, ...JSON.parse(Body) }));

    const results = await startScrapingBatch({ entries: messagesBodies });

    logger.info('Scrap proccess finished, deleting messages');

    for (const result of results) {
      const { ReceiptHandle } = result.tags;

      if (result.success) {
        logger.info('Successfully scraped message, deleting form queue', { ReceiptHandle });

        await sqs.deleteMessage({ QueueUrl: process.env.SCRAPING_QUEUE_URL, ReceiptHandle }).promise();
      } else {
        logger.info('Couldn\'t scrap message, , message will return to queue after timeout', { ReceiptHandle });
      }
    }

    logger.info('Messages successfully processed');

    return true;
  } catch (error) {
    logger.error('Couldn\'t start scrap process, messages will return to queue after timeout', { error });
  }
}

/**
* @description Script function responsible for consuming ScrapingQueue and running scraper
* @command sls invoke local -f ConsumeQueue
*/
export async function main () {
  logger.setLevel('info');

  while (true) {
    const params = { QueueUrl: process.env.SCRAPING_QUEUE_URL, MaxNumberOfMessages: 3 };

    logger.info('Fetching messages', { params });

    const response = await sqs.receiveMessage(params).promise();

    const {
      Messages = []
    } = response;

    if (Messages.length) {
      logger.info('Fetched messages', { messagesNumber: Messages.length });

      await processMessages(Messages);
    } else {
      logger.info('Queue is empty, waiting to try again', { messagesNumber: Messages.length });

      await sleep(60000); // 1 minute
    }
  }
};