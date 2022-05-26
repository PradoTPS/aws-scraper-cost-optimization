import logger from 'loglevel';
import { CloudWatch, CloudWatchLogs } from 'aws-sdk';

const cloudwatch = new CloudWatch({ apiVersion: '2010-08-01' });
const cloudwatchLogs = new CloudWatchLogs({ apiVersion: '2014-03-28' });

export default class CloudWatchHelper {
  constructor() {
    this.logStreamName = null;
    this.nextSequenceToken = null;
  }

  async initializeLogStream(logStreamName) {
    await cloudwatchLogs.createLogStream({
      logGroupName: process.env.CLUSTER_LOG_GROUP_NAME, /* required */
      logStreamName: logStreamName, /* required */
    }).promise();

    this.logStreamName = logStreamName;

    return true;
  }

  async logAndRegisterMessage(message) {
    logger.info(message);

    if (this.logStreamName) {
      const {
        nextSequenceToken,
      } = await cloudwatchLogs.putLogEvents({
        logEvents: [ /* required */
          {
            message: message, /* required */
            timestamp: Date.now() /* required */
          },
          /* more items */
        ],
        logGroupName: process.env.CLUSTER_LOG_GROUP_NAME, /* required */
        logStreamName: this.logStreamName, /* required */
        sequenceToken: this.nextSequenceToken
      }).promise();

      this.nextSequenceToken = nextSequenceToken;
    } else {
      logger.warn('Log stream must be initialized to register logs');
    }

    return true;
  }

  static async getLastMetric({ metricDataQuery }) {
    const now = new Date();

    const {
      MetricDataResults: [{
        Values: [metricData],
      }],
    } = await cloudwatch.getMetricData({
      EndTime: now.toISOString(),
      StartTime:  new Date(now - 180000).toISOString(), /// 3 minutes ago
      MetricDataQueries: [metricDataQuery],
    }).promise();

    return metricData;
  }

  static async getLogMessages({ startTime, filterPattern } = {}) {
    const {
      events,
    } = await cloudwatchLogs.filterLogEvents({
      logGroupName: process.env.CLUSTER_LOG_GROUP_NAME, /* required */
      filterPattern,
      startTime,
    }).promise();

    return events.map(({ message }) => JSON.parse(message));
  }
}