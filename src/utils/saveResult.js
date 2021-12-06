import { S3 } from 'aws-sdk';

/**
* @description Function responsible for saving a crawl result on S3
* @param {Object} result - Base lambda event
* @param {String} bucketName - Name of bucket were data will be saved
* @param {Object} options - Base lambda event
* @param {String} options.type - Type of crawler, will be used on folder structure
* @param {String} options.name - Crawler name, will be used on folder structure
*/
export default async function saveResult (result, bucketName, { type, name }) {
  const s3 = new S3();
  const resultS3Path = `${type}/${name}/${Date.now()}`;

  await s3.putObject({
    ACL: 'private',
    Bucket: bucketName,
    Key: resultS3Path,
    Body: result,
    ContentType: 'text/html',
  }).promise();

  return `https://${bucketName}.s3.amazonaws.com/${resultS3Path}`;
};
