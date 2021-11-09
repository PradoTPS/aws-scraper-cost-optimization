import logger from 'loglevel';

export default async function main ({ registrationNumber }) {
  logger.info('Started COREN RJ crawler', { registrationNumber });

  return true;
}