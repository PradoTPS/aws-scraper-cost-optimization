import logger from 'loglevel';
import { SQS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

import sleep from 'Utils/sleep';

const sqs = new SQS();

async function sendMessage(message) {
  const uniqueId = uuidv4();

  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: process.env.SCRAPING_QUEUE_URL,
    MessageGroupId: uniqueId, // messages that belong to the same message group are processed in a FIFO manner (however, messages in different message groups might be processed out of order)
    MessageDeduplicationId: uniqueId
  };

  console.log(params);

  return sqs.sendMessage(params).promise();
}

/**
* @description Script function responsible for populating ScrapingQueue with test data
* @param {Object} event - Base lambda event
* @param {Number} event.batchSize - Integer size indicating the number of messages sent by batch
* @param {Number} event.numberOfBatches - Integer size indicating the number of batches to be sent
* @param {Number} event.delay - Integer time in milliseconds indicating the delay between batches
* @command sls invoke local -f PopulateQueue -p tests/events/populateQueue.json
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    batchSize = 1,
    numberOfBatches = 1,

    delay = 0
  } = event;

  const defaultMessage = {
    type: 'coren',
    name: 'sp',
    informations: {
      registrationNumber: '1109410'
    }
  };

  for (let index = 1; index <= numberOfBatches; index++) {
    logger.info('Sending batch', { batchNumber: index, numberOfBatches, batchSize });

    const messages = Array.from({ length: batchSize }, (_, index) =>  ({ body: defaultMessage, deduplicationId: index.toString() }) );

    const promises = messages.map((message) => sendMessage(message.body));

    await Promise.all(promises);

    if (index != numberOfBatches) {
      logger.info('Batch successfully sent, waiting delay', { delay });
      await sleep(delay);
    }
  }

  return true;
};
