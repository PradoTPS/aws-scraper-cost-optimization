import { SQS } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const sqs = new SQS();

async function sendMessage(message) {
  const uniqueId = uuidv4();

  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: process.env.QUEUE_URL,
    MessageGroupId: uniqueId, // messages that belong to the same message group are processed in a FIFO manner (however, messages in different message groups might be processed out of order)
    MessageDeduplicationId: uniqueId
  };

  console.log(params);

  return sqs.sendMessage(params).promise();
}

/**
* @description Script function responsible for populating CrawlQueue with test data
* @command sls invoke local -f PopulateQueue
*/
export async function main () {
  const defaultMessage = {
    type: 'coren',
    name: 'sp',
    informations: {
      registrationNumber: '1109410'
    }
  };

  const messages = Array.from({ length: 350 }, (_, index) =>  ({ body: defaultMessage, deduplicationId: index.toString() }) );

  const promises = messages.map((message) => sendMessage(message.body));

  await Promise.all(promises);

  return true;
};
