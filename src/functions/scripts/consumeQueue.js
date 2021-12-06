import logger from 'loglevel';
import { SQS } from 'aws-sdk';

import sleep from 'Utils/sleep';
import { main as startScrapingBatch } from 'Functions/startScrapingBatch';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function processMessages(messages) {
  try {
    logger.info('Starting scrap proccess');

    const messagesBodies = messages.map(({ Body }) => JSON.parse(Body));

    await startScrapingBatch({ entries: messagesBodies });

    logger.info('Scrap proccess finished, deleting messages');

    for (const message of messages) await sqs.deleteMessage({ QueueUrl: process.env.SCRAPING_QUEUE_URL, ReceiptHandle: message.ReceiptHandle }).promise();

    logger.info('Messages successfully processed');

    return true;
  } catch (error) {
    logger.error('Couldn\'t start scrap process, message will return to queue after timeout', { error });
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