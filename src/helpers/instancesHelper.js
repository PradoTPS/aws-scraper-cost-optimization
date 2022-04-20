import { EC2 } from 'aws-sdk';

const ec2 = new EC2({apiVersion: '2016-11-15'});

export default class CloudWatchHelper {
  static async createInstances({ numberOfInstances = 1, instanceType = 't2.nano' } = {}) {
    const parameters = {
      ImageId: 'ami-04ad2567c9e3d7893', // using aws default image while we create ours
      InstanceType: instanceType,
      MinCount: numberOfInstances, // maximum number of instances to launch. If you specify more instances than Amazon EC2 can launch in the target Availability Zone, Amazon EC2 launches the largest possible number of instances above MinCount
      MaxCount: numberOfInstances, // minimum number of instances to launch. If you specify a minimum that is more instances than Amazon EC2 can launch in the target Availability Zone, Amazon EC2 launches no instances.
      KeyName: process.env.EC2_KEY_NAME,
      SecurityGroupIds: [process.env.SECURITY_GROUP_NAME]
    };

    const {
     Instances: instances,
    } = await ec2.runInstances(parameters).promise();

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

  static async terminateInstances({ instanceIds } = {}) {
    const parameters = {
      InstanceIds: instanceIds,
    };

    const {
      TerminatingInstances: terminateInstances,
    } = await ec2.terminateInstances(parameters).promise();

    return terminateInstances.map(
             (terminateInstance) => (
               {
                 instanceId: terminateInstance.InstanceId,
                 newState: terminateInstance.CurrentState?.Name,
                 previousState: terminateInstance.PreviousState?.Name,
               }
             )
           );
  }
}