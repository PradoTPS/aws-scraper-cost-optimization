import logger from 'loglevel';

import CrawlersTypes from 'Crawlers';

import saveResult from 'Utils/saveResult';
import launchBrowser from 'Utils/launchBrowser';
import { InvalidInputError } from 'Utils/errors';

/**
* @description Function responsible for calling specific crawler based on type and regionality
* @param {Object} event - Base lambda event
* @param {Array.<{ type: String, name: String, informations: Object }>} event.entries - Array of entries to be crawled
* @command sls invoke local -f StartCrawlBatch -p tests/events/startCrawlBatch.json
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

      const Crawlers = CrawlersTypes[type];

      if (!Crawlers) throw new InvalidInputError(`Crawler's type ${type} does not exists`);

      const Crawler = Crawlers[name];

      if (!Crawler) throw new InvalidInputError(`${name} is not a valid ${type} crawler`);

      const crawler = new Crawler(informations);

      const result = await crawler.crawl(browser);

      const resultS3Url = await saveResult(result, process.env.CRAWL_RESULT_BUCKET, { type, name });

      return resultS3Url;
    }
  );

  await Promise.all(promises);

  return true;
};
