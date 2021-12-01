import logger from 'loglevel';
import { SQS } from 'aws-sdk';

import sleep from 'Utils/sleep';
import { main as startCrawl } from 'Functions/startCrawl';

const sqs = new SQS({ apiVersion: '2012-11-05' });

async function processMessage(message) {
  const {
    Body,
    ReceiptHandle,
  } = message;

  try {
    logger.info('Starting crawl proccess', { Body, ReceiptHandle });

    await startCrawl(JSON.parse(Body));

    logger.info('Crawl proccess finished, deleting message', { ReceiptHandle });

    await sqs.deleteMessage({ QueueUrl: process.env.QUEUE_URL, ReceiptHandle }).promise();

    logger.info('Message successfully processed', { ReceiptHandle });

    return true;
  } catch (error) {
    logger.error('Couldn\'t start crawl process, message will return to queue after timeout', { error, ReceiptHandle });
  }
}

/**
* @description Script function responsible for consuming CrawlQueue and running crawl
* @command sls invoke local -f ConsumeQueue
*/
export async function main () {
  logger.setLevel('info');

  while (true) {
    const params = { QueueUrl: process.env.QUEUE_URL, MaxNumberOfMessages: 3 };

    logger.info('Fetching messages', { params });

    const response = await sqs.receiveMessage(params).promise();

    const {
      Messages = []
    } = response;

    if (Messages.length) {
      logger.info('Fetched messages', { messagesNumber: Messages.length });

      const promises = Messages.map((message) => processMessage(message));

      await Promise.all(promises);
    } else {
      logger.info('Queue is empty, waiting to try again', { messagesNumber: Messages.length });

      await sleep(60000); // 1 minute
    }
  }
};