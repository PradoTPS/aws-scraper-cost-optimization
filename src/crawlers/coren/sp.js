import logger from 'loglevel';
import { InvalidInputError } from 'Utils/errors';

export default class {
  url = 'teste';

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

    return true;
  }
};