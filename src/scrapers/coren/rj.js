import logger from 'loglevel';

import launchBrowser from 'Utils/launchBrowser';
import { InvalidInputError } from 'Utils/errors';

export default class {
  url = 'https://servicos.coren-rj.org.br/appcorenrj/incorpnet.dll/Controller?pagina=pub_mvcLogin.htm&conselho=corenrj';

  constructor(informations) {
    const {
      registrationNumber
    } = informations;

    if (!registrationNumber) throw new InvalidInputError('Scraper must have registrationNumber information');

    this.informations = informations;
  }

  async scrap(_browser) {
    const registrationNumber = this.informations.registrationNumber;

    logger.info('Started COREN RJ scraper', { registrationNumber });

    // use recieved browser or create new one
    const browser = _browser || await launchBrowser();

    const page = await browser.newPage();

    logger.info('Navigating', { url: this.url });

    await page.goto(this.url, { waitUntil: 'networkidle2' });

    const [consultNavigateButton] = await page.$x('//button[contains(., "de Cadastro")]');

    await Promise.all([
      consultNavigateButton.click(),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    logger.info('Sending form', { registrationNumber });

    await page.type('input[name="EDT_NumeroInscricao"]', registrationNumber);

    logger.info('Waiting form response');

    await Promise.all([
      page.click('input[name="BTN_Consultar"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const html = await page.content();

    logger.info('Fetched response');

    // only close if browser is not recieved
    if (!_browser) await browser.close();

    return html;
  }
};