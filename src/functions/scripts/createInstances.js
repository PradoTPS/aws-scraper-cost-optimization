import InstancesHelper from 'Helpers/instancesHelper';

/**
* @description Script function responsible for creating instances
* @param {Object} event - Base lambda event
* @param {Number} event.numberOfInstances - Integer size indicating the number of instances to be created
* @param {String} event.instanceType - String defining instance type (https://aws.amazon.com/pt/ec2/instance-types)
* @command sls invoke local -f CreateInstances -p tests/events/createInstances.json
*/
export async function main (event) {
  const {
    numberOfInstances,
    instanceType,
  } = event;

  return InstancesHelper.createInstances({ numberOfInstances, instanceType });
};
