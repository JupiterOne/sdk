import { IntegrationError } from '@jupiterone/integration-sdk-core';

export class IntegrationApiKeyRequiredError extends IntegrationError {
  constructor() {
    super({
      code: 'JUPITERONE_API_KEY_ENVIRONMENT_VARIABLE_NOT_SET',
      message: 'The JUPITERONE_API_KEY environment variable must be set',
    });
  }
}

export class IntegrationAccountRequiredError extends IntegrationError {
  constructor() {
    super({
      code: 'JUPITERONE_ACCOUNT_ENVIRONMENT_VARIABLE_NOT_SET',
      message: 'The JUPITERONE_ACCOUNT environment variable must be set',
    });
  }
}
