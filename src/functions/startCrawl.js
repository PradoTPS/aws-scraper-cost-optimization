import logger from 'loglevel';
import crawlersTypes from 'Crawlers';
import { InvalidInputError } from 'Utils/errors';

/**
* @description Function responsible for calling specific crawler based on type and regionality
* @param {Object} event - Base lambda event
* @param {String} event.type - Type of crawler that will be called
* @param {String} event.name - Crawler name, options depends on crawler type (see crawler type specific folder)
* @param {Object} event.informations - Crawling informations, options depends on crawler type (see crawler type specific folder)
* @command sls invoke local -f StartCrawl -p tests/events/startCrawl.json
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    type,
    name,
    informations,
  } = event;

  if (!type || !name) throw new InvalidInputError('Event must have type and name properties');

  const crawlers = crawlersTypes[type];

  if (!crawlers) throw new InvalidInputError(`Crawler's type ${type} does not exists`);

  const crawler = crawlers[name];

  if (!crawler) throw new InvalidInputError(`${name} is not a valid ${type} crawler`);

  const result = await crawler(informations);

  return {
    message: 'Crawler successfully finished',
    result,
  };
};
