import metadata from 'node-ec2-metadata';

export default async function getInstanceId() {
  let instanceId;

  if (process.env.IS_INSTANCE) {
    instanceId = await metadata.getMetadataForInstance('instance-id');
  } else {
    instanceId =  process.env.IS_LOCAL ? 'local' : 'lambda';
  }

  return instanceId;
}