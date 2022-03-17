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

export class IntegrationMaxTimeoutBadValueError extends IntegrationError {
  constructor() {
    super({
      code: 'SDK_API_CLIENT_MAX_TIMEOUT_BAD_VALUE',
      message:
        'The SDK_API_CLIENT_MAX_TIMEOUT environment variable is not a number',
    });
  }
}
