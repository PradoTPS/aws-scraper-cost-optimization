import logger from 'loglevel';

import InstancesHelper from 'Helpers/instancesHelper';

/**
* @description Script function responsible for terminating instances
* @param {Object} event - Base lambda event
* @param {Number} event.numberOfInstances - Integer size indicating the number of instances to be terminated, if instanceIds is empty will try to delete this number of instances
* @param {Array.<String>} event.instanceIds - Array of Strings defining identifiers of instances to be terminated
* @command sls invoke local -f TerminateInstances -p tests/events/terminateInstances.json
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    instanceIds,
    numberOfInstances,
  } = event;

  return InstancesHelper.terminateInstances({ instanceIds, numberOfInstances });
};
