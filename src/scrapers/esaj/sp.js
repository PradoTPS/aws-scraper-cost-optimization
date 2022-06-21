import logger from 'loglevel';

import launchBrowser from 'Utils/launchBrowser';
import { InvalidInputError } from 'Utils/errors';

export default class {
  url = 'https://esaj.tjsp.jus.br/cposg/open.do';

  constructor(informations) {
    const {
      cpf,
    } = informations;

    if (!cpf) throw new InvalidInputError('Scraper must have cpf information');

    this.informations = informations;
  }

  async scrap(_browser) {
    const cpf = this.informations.cpf;

    logger.info('Started COREN SP scraper', { cpf });

    // use recieved browser or create new one
    const browser = _browser || await launchBrowser();

    const page = await browser.newPage();

    logger.info('Navigating', { url: this.url });

    await page.goto(this.url, { waitUntil: 'networkidle2' });

    logger.info('Sending form', { cpf });

    await page.select('select[name="cbPesquisa"]', 'DOCPARTE');

    await page.type('input[id="campo_DOCPARTE"]', cpf);

    logger.info('Waiting form response');

    await Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const html = await page.content();

    logger.info('Fetched response');

    // only close if browser is not recieved
    if (!_browser) await browser.close();

    return html;
  }
};