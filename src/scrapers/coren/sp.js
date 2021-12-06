import logger from 'loglevel';

import launchBrowser from 'Utils/launchBrowser';
import { InvalidInputError } from 'Utils/errors';

export default class {
  url = 'https://portal.coren-sp.gov.br/consulta-de-inscritos/';

  constructor(informations) {
    const {
      registrationNumber
    } = informations;

    if (!registrationNumber) throw new InvalidInputError('Scraper must have registrationNumber information');

    this.informations = informations;
  }

  async scrap(_browser) {
    const registrationNumber = this.informations.registrationNumber;

    logger.info('Started COREN SP scraper', { registrationNumber });

    // use recieved browser or create new one
    const browser = _browser || await launchBrowser();

    const page = await browser.newPage();

    logger.info('Navigating', { url: this.url });

    await page.goto(this.url, { waitUntil: 'networkidle2' });

    logger.info('Sending form', { registrationNumber });

    await page.click('input[name="tipo_pesquisa"][value="inscricao"]');
    await page.type('input[name="texto_pesquisa"]', registrationNumber);

    logger.info('Waiting form response');

    await Promise.all([
      page.click('button.button--primary.button--large.button--block'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const html = await page.content();

    logger.info('Fetched response', { response: html });

    // only close if browser is not recieved
    if (!_browser) await browser.close();

    return html;
  }
};