import logger from 'loglevel';

import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer';

export default async function launchBrowser () {
  if (process.env.IS_LOCAL) {
    logger.info('Invoked locally, lauching default pupputeer');

    return puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium'
    });
  } else {
    logger.info('Invoked remotely, lauching chrome-aws-lambda pupputeer');

    return chromium.puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
  }
};
