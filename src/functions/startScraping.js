import logger from 'loglevel';

import ScrapersTypes from 'Scrapers';

import saveResult from 'Utils/saveResult';
import { InvalidInputError } from 'Utils/errors';

/**
* @description Function responsible for calling specific scraper based on type and regionality
* @param {Object} event - Base lambda event
* @param {String} event.type - Type of scraper that will be called
* @param {String} event.name - Scraper name, options depends on scraper type (see scraper type specific folder)
* @param {Object} event.informations - Scrapping informations, options depends on scraper type (see scraper type specific folder)
* @command sls invoke local -f StartScraping -p tests/events/startScraping.json
*/
export async function main (event) {
  logger.setLevel('info');

  const {
    type,
    name,
    informations,
  } = event;

  if (!type || !name) throw new InvalidInputError('Event must have type and name properties');

  const Scrapers = ScrapersTypes[type];

  if (!Scrapers) throw new InvalidInputError(`Scrapers's type ${type} does not exists`);

  const Scraper = Scrapers[name];

  if (!Scraper) throw new InvalidInputError(`${name} is not a valid ${type} scraper`);

  const scraper = new Scraper(informations);
  const result = await scraper.scrap();

  const resultS3Url = await saveResult(result, process.env.SCRAPING_RESULT_BUCKET, { type, name });

  return {
    message: 'Scraper successfully finished',
    resultS3Url,
  };
};
