import logger from 'loglevel';
import { EC2 } from 'aws-sdk';
import { NodeSSH } from 'node-ssh';

const ec2 = new EC2({ apiVersion: '2016-11-15' });

async function getTerminableInstances(numberOfInstances) {
  logger.info('Fetching instance to delete', { numberOfInstances });

  const {
    Reservations: [{ Instances: instances = [] } = {}]
  } = await ec2.describeInstances({
    Filters: [
      {
        Name: 'tag:createdBy',
        Values: ['orchestrator']
      },
      {
        Name: 'instance-state-name',
        Values: ['running']
      },
    ],
    MaxResults: numberOfInstances >= 5 ? numberOfInstances : 5, // minimum is 5, if numberOfInstances is lower we treat it after
  }).promise();

  const terminableInstanceIds = instances.map((instance) => instance.InstanceId);

  const instanceIdsToBeTerminated = terminableInstanceIds.length > numberOfInstances
                                      ? terminableInstanceIds.slice(0, numberOfInstances)
                                      : terminableInstanceIds;

  logger.info('Fetched instances to be terminated', { terminableInstanceIds, instanceIdsToBeTerminated });

  return instanceIdsToBeTerminated;
}

export default class InstancesHelper {
  static async createInstances({ numberOfInstances = 1, instanceType = 't2.nano' } = {}) {
    const {
      Instances: instances,
    } = await ec2.runInstances({
      ImageId: 'ami-04ad2567c9e3d7893', // using aws default image while we create ours
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
    if (!instanceIds?.length && numberOfInstances) instanceIds = await getTerminableInstances(numberOfInstances);

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

  static async startQueueConsumeOnInstance({ instanceId, username = 'ec2-user', privateKey = '/home/ec2-user/aws-scraper-cost-optimization/local/scraper-instance-key-pair.pem' } = {}) {
    logger.info('Getting public dns of the provided instance', { instanceId });

    const {
      Reservations: [{ Instances: [instance] } = {}]
    } = await ec2.describeInstances({
      InstanceIds: [instanceId],
      Filters: [
        {
          Name: 'instance-state-name',
          Values: ['running']
        },
      ],
    }).promise();

    const {
      PublicDnsName: host
    } = instance;

    const ssh = new NodeSSH();

    logger.info('Connect SSH', { instanceId, username, privateKey });

    await ssh.connect({
      host,
      username,
      privateKey
    });

    logger.info('Run consume queue', { instanceId, username, privateKey });

    const {
      stdout,
      stderr,
    } = await ssh.execCommand('nohup sls invoke local -f ConsumeQueue -p tests/events/consumeQueue.json & disown', { cwd:'/home/ec2-user/aws-scraper-cost-optimization' });

    await ssh.dispose();

    return {
      stdout,
      stderr,
    };
  }
}