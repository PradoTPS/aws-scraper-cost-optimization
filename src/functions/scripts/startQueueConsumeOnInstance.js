import logger from 'loglevel';

import InstancesHelper from 'Helpers/instancesHelper';

/**
* @description Script function responsible for start queue consume process on the provided instance
* @param {Object} event - Base lambda event
* @param {String} event.instanceId - Id of the desired EC2 instance
* @param {String} event.username - User to connect via SSH
* @param {String} event.privateKey - Path to key pair to connect via SSH
* @command sls invoke local -f StartQueueConsumeOnInstance -p tests/events/startQueueConsumeOnInstance.json
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    instanceId,
    username,
    privateKey,
  } = event;

  return InstancesHelper.startQueueConsumeOnInstance({ instanceId, username, privateKey });
};
