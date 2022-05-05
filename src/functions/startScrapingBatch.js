import logger from 'loglevel';

import ScrapersTypes from 'Scrapers';

import saveResult from 'Utils/saveResult';
import launchBrowser from 'Utils/launchBrowser';
import { InvalidInputError } from 'Utils/errors';

/**
* @description Function responsible for calling specific scraper based on type and regionality
* @param {Object} event - Base lambda event
* @param {Array.<{ type: String, name: String, createdAt: String, firstReceivedAt: String, informations: Object, tags: Object }>} event.entries - Array of entries to be scraped
* @command sls invoke local -f StartScrapingBatch -p tests/events/startScrapingBatch.json
*/
export async function main (event) {
  logger.setLevel('info');

  const browser = await launchBrowser();

  const promises = event.entries.map(
    async (entry) => {
      const response = entry;

      try {
        const {
          type,
          name,
          informations,
          createdAt,
          firstReceivedAt,
        } = entry;

        if (!type || !name) throw new InvalidInputError('Event must have type and name properties');

        const Scrapers = ScrapersTypes[type];

        if (!Scrapers) throw new InvalidInputError(`Scrapers's type ${type} does not exists`);

        const Scraper = Scrapers[name];

        if (!Scraper) throw new InvalidInputError(`${name} is not a valid ${type} scraper`);

        const scraper = new Scraper(informations);
        const result = await scraper.scrap(browser);

        response.processingTime = Date.now() - createdAt;
        response.serviceTime = Date.now() - firstReceivedAt;
        response.resultUrl = await saveResult(result, process.env.SCRAPING_RESULT_BUCKET, { type, name });
        response.success = true;
      } catch (error) {
        logger.error('Couldn\'t finish scrap process', error);

        response.success = false;
      }

      return response;
    }
  );

  const results = await Promise.all(promises);

  await browser.close();

  return results;
};
