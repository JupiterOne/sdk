import { IntegrationError } from '../../errors';

export class IntegrationMissingCollectJSON extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'MissingCollectJSON',
      message,
    });
  }
}
