import { SQS } from 'aws-sdk';

const sqs = new SQS();

async function sendMessage(message, deduplicationId) {
  const params = {
    MessageBody: JSON.stringify(message),
    QueueUrl: process.env.queueUrl,
    MessageGroupId: 'populate-queue-script', // messages that belong to the same message group are processed in a FIFO manner (however, messages in different message groups might be processed out of order)
    MessageDeduplicationId: deduplicationId
  };

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

  const messages = Array.from({ length: 50 }, (_, index) =>  ({ body: defaultMessage, deduplicationId: index.toString() }) );

  const promises = messages.map((message) => sendMessage(message.body, message.deduplicationId));

  await Promise.all(promises);

  return true;
};
