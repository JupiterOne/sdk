import { IntegrationError } from '../../errors';

export class IntegrationMalformedApiKeyError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'MalformedApiKeyError',
      message,
    });
  }
}

export class IntegrationApiKeyRequiredError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'JupiterOneApiKeyEnvironmentVariableNotSet',
      message,
    });
  }
}

export function malformedApiKeyError() {
  return new IntegrationMalformedApiKeyError('Malformed API Key provided');
}

export function apiKeyRequiredError() {
  return new IntegrationMalformedApiKeyError(
    'The JUPITERONE_API_KEY environment variable must be set',
  );
}
