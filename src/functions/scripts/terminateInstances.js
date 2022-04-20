import InstancesHelper from 'Helpers/instancesHelper';

/**
* @description Script function responsible for creating instances
* @param {Object} event - Base lambda event
* @param {Array.<String>} event.instanceIds - Array of Strings defining identifiers of instances to be deleted
* @command sls invoke local -f TerminateInstances -p tests/events/terminateInstances.json
*/
export async function main (event) {
  const {
    instanceIds,
  } = event;

  return InstancesHelper.terminateInstances({ instanceIds });
};
