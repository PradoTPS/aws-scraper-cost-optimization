import logger from 'loglevel';
import sleep from 'Utils/sleep';
import { EC2 } from 'aws-sdk';
import { NodeSSH } from 'node-ssh';

const ec2 = new EC2({ apiVersion: '2016-11-15' });

export default class InstancesHelper {
  static async getInstancesIds({ maximumNumberOfInstances, filters }) {
    const parameters = {
      Filters: filters,
      ...maximumNumberOfInstances ? { MaxResults: maximumNumberOfInstances >= 5 ? maximumNumberOfInstances : 5 } : {}, // minimum is 5, if numberOfInstances is lower we treat it after
    };

    logger.info('Fetching instances', { ...parameters });

    const {
      Reservations: reservations,
    } = await ec2.describeInstances(parameters).promise();

    const instanceIds = reservations.reduce(
      (ids, { Instances: instances = [] }) => {
        return [...ids, ...instances.map((instance) => instance.InstanceId)];
      },
      [],
    );

    const slicedInstanceIds = maximumNumberOfInstances && instanceIds.length > maximumNumberOfInstances
                                        ? instanceIds.slice(0, maximumNumberOfInstances)
                                        : instanceIds;

    logger.info('Fetched instances', { instanceIds, slicedInstanceIds  });

    return slicedInstanceIds;
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
      instanceIds = await this.getInstancesIds({
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

  static async startQueueConsumeOnInstance({ instanceId, username = 'ec2-user', privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem', consumeQueueEventPath = 'tests/events/consumeQueue/default.json' } = {}) {
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

    logger.info('Run consume queue', { instanceId, username, privateKey });

    return ssh.execCommand(`sls invoke local -f ConsumeQueue -p ${consumeQueueEventPath}`, { cwd:'/home/ec2-user/aws-scraper-cost-optimization' });
  }
}