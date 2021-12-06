import logger from 'loglevel';

import ScrapersTypes from 'Scrapers';

import saveResult from 'Utils/saveResult';
import launchBrowser from 'Utils/launchBrowser';
import { InvalidInputError } from 'Utils/errors';

/**
* @description Function responsible for calling specific scraper based on type and regionality
* @param {Object} event - Base lambda event
* @param {Array.<{ type: String, name: String, informations: Object }>} event.entries - Array of entries to be scraped
* @command sls invoke local -f StartScrapingBatch -p tests/events/startScrapingBatch.json
*/
export async function main (event) {
  logger.setLevel('info');

  const browser = await launchBrowser();

  const promises = event.entries.map(
    async (entry) => {
      const {
        type,
        name,
        informations,
      } = entry;

      if (!type || !name) throw new InvalidInputError('Event must have type and name properties');

      const Scrapers = ScrapersTypes[type];

      if (!Scrapers) throw new InvalidInputError(`Scrapers's type ${type} does not exists`);

      const Scraper = Scrapers[name];

      if (!Scraper) throw new InvalidInputError(`${name} is not a valid ${type} scraper`);

      const scraper = new Scraper(informations);
      const result = await scraper.scrap(browser);

      const resultS3Url = await saveResult(result, process.env.SCRAPING_RESULT_BUCKET, { type, name });

      return resultS3Url;
    }
  );

  await Promise.all(promises);

  return true;
};
