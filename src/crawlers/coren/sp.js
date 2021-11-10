import logger from 'loglevel';
import chromium from 'chrome-aws-lambda';

import { InvalidInputError } from 'Utils/errors';

export default class {
  url = 'https://portal.coren-sp.gov.br/consulta-de-inscritos/';

  constructor(informations) {
    const {
      registrationNumber
    } = informations;

    if (!registrationNumber) throw new InvalidInputError('Crawler must have registrationNumber information');

    this.informations = informations;
  }

  async crawl() {
    const registrationNumber = this.informations.registrationNumber;

    logger.info('Started COREN SP crawler', { registrationNumber });

    const browser = await chromium.puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.goto(this.url, { waitUntil: 'networkidle2' });

    await page.click('input[name="tipo_pesquisa"][value="inscricao"]');
    await page.type('input[name="texto_pesquisa"]', registrationNumber);

    await Promise.all([
      page.click('button.button--primary.button--large.button--block'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const html = await page.content();

    await browser.close();

    return html;
  }
};