import { IntegrationError } from '@jupiterone/integration-sdk-core';

export class IntegrationMissingValidateFunction extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'MISSING_VALIDATE_FUNCTION',
      message,
    });
  }
}
