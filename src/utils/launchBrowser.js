import logger from 'loglevel';

import chromium from 'chrome-aws-lambda';
// import puppeteer from 'puppeteer';

export default async function launchBrowser () {
  let executablePath;

  if (process.env.IS_LOCAL) {
    logger.info('Invoked locally, using local chrome');

    executablePath = '/usr/bin/google-chrome-stable';
  } else {
    logger.info('Invoked remotely, lauching chrome-aws-lambda pupputeer');

    executablePath = await chromium.executablePath;
  }

  return chromium.puppeteer.launch({
    args: chromium.args,
    headless: chromium.headless,
    executablePath,
  });
};
