import logger from 'loglevel';

import chromium from 'chrome-aws-lambda';

import { ConfigurationError } from 'Utils/errors';

export default async function launchBrowser () {
  let executablePath;

  if (process.env.IS_LOCAL) {
    logger.info('Invoked locally, using local chrome');

    const { CHROME_PATH: path } = process.env;

    if (!path) throw new ConfigurationError('Must export CHROME_PATH environment variable');

    executablePath = process.env.CHROME_PATH;
  } else {
    logger.info('Invoked remotely, lauching chrome-aws-lambda pupputeer');

    executablePath = await chromium.executablePath;
  }

  return chromium.puppeteer.launch({
    args: chromium.args,
    headless: false,
    executablePath,
  });
};
