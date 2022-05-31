import logger from 'loglevel';
import sleep from 'Utils/sleep';
import { EC2 } from 'aws-sdk';
import { NodeSSH } from 'node-ssh';

const ec2 = new EC2({ apiVersion: '2016-11-15' });

export default class InstancesHelper {
  static async getInstances({ maximumNumberOfInstances, filters }) {
    const parameters = {
      Filters: filters,
    };

    logger.info('Fetching instances', { ...parameters });

    const {
      Reservations: reservations,
    } = await ec2.describeInstances(parameters).promise();

    const instances = reservations.reduce(
      (instancesAccumulator, { Instances: currentInstances = [] }) => {
        return [...instancesAccumulator, ...currentInstances];
      },
      [],
    );

    const slicedInstances = maximumNumberOfInstances && instances.length > maximumNumberOfInstances
                                        ? instances.slice(0, maximumNumberOfInstances)
                                        : instances;

    return slicedInstances;
  }

  static async createInstances({ numberOfInstances = 1, instanceType = 't2.small' } = {}) {
    logger.info('Creating instances', { numberOfInstances, instanceType });

    const {
      Instances: instances,
    } = await ec2.runInstances({
      ImageId: process.env.IMAGE_ID,
      InstanceType: instanceType,
      MinCount: numberOfInstances, // maximum number of instances to launch. If you specify more instances than Amazon EC2 can launch in the target Availability Zone, Amazon EC2 launches the largest possible number of instances above MinCount
      MaxCount: numberOfInstances, // minimum number of instances to launch. If you specify a minimum that is more instances than Amazon EC2 can launch in the target Availability Zone, Amazon EC2 launches no instances.
      KeyName: process.env.EC2_KEY_NAME,
      SecurityGroupIds: [process.env.SECURITY_GROUP_NAME],
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            {
              Key: "createdBy",
              Value: "orchestrator"
            }
          ]
        }
      ],
    }).promise();

    return instances.map(
      (instance) => (
        {
          imageId: instance.ImageId,
          instanceId: instance.InstanceId,
          state: instance.State?.Name
        }
      )
    );
  }

  static async terminateInstances({ instanceIds, numberOfInstances } = {}) {
    if (!instanceIds?.length && numberOfInstances) {
      const instances = await this.getInstances({
        maximumNumberOfInstances: numberOfInstances,
        filters: [
          {
            Name: 'tag:createdBy',
            Values: ['orchestrator']
          },
          {
            Name: 'instance-state-name',
            Values: ['running']
          },
        ],
      });

      instanceIds = instances.map((instance) => instance.InstanceId);
    }

    if (instanceIds?.length) {
      const {
        TerminatingInstances: terminatingInstances,
      } = await ec2.terminateInstances({
        InstanceIds: instanceIds,
      }).promise();

      return terminatingInstances.map(
        (terminatingInstance) => (
          {
            instanceId: terminatingInstance.InstanceId,
            newState: terminatingInstance.CurrentState?.Name,
            previousState: terminatingInstance.PreviousState?.Name,
          }
        )
      );
    } else {
      logger.warn('Couldn\'t find instances to delete');

      return [];
    }
  }

  static async getInstanceStatus({ instanceId }) {
    let statusName;

    try {
      const {
        InstanceStatuses: [{
          InstanceState: {
            Name: newStatusName
          },
        } = {}],
      } = await ec2.describeInstanceStatus({
        InstanceIds: [instanceId],
      }).promise();

      statusName = newStatusName;
    } catch (error) {
      statusName = 'unavailable';
    }

    return statusName;
  }

  static async waitInstanceFinalStatus({ instanceId }) {
    let status = await this.getInstanceStatus({ instanceId });

    logger.info('Fetched initial instance status', { instanceStatus: status });

    while (!['running', 'shutting-down', 'terminated', 'stopped'].includes(status)) {
      logger.info('Fetched non final instance status, waiting 10 seconds and trying again', { instanceStatus: status });
      await sleep(10000); // 10 s

      status = await this.getInstanceStatus({ instanceId });
    }

    return status;
  }

  static async startQueueConsumeOnInstance({
    instanceId,
    username = 'ec2-user',
    privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem',
    readBatchSize = 5,
  } = {}) {
    logger.info('Getting public dns of the provided instance', { instanceId });

    const {
      Reservations: [{ Instances: [instance] } = {}]
    } = await ec2.describeInstances({
      InstanceIds: [instanceId],
    }).promise();

    const {
      PublicDnsName: host
    } = instance;

    const ssh = new NodeSSH();

    logger.info('Connect SSH', { instanceId, username, privateKey });

    await ssh.connect({
      host,
      username,
      privateKey,
    });

    const params = [`sls invoke local -f ConsumeQueue -d '{ "readBatchSize": ${readBatchSize} }'`, { cwd:'/home/ec2-user/aws-scraper-cost-optimization' }];

    logger.info('Run consume queue', { instanceId, username, privateKey, params });

    return ssh.execCommand(...params);
  }
}