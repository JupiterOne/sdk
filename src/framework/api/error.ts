import { IntegrationError } from '../execution/error';

export class IntegrationMalformedApiKeyError extends Error
  implements IntegrationError {
  code = 'MalformedApiKeyError';
}

export class IntegrationApiKeyRequiredError extends Error
  implements IntegrationError {
  code = 'JupiterOneApiKeyEnvironmentVariableNotSet';
}

export function malformedApiKeyError() {
  return new IntegrationMalformedApiKeyError('Malformed API Key provided');
}

export function apiKeyRequiredError() {
  return new IntegrationMalformedApiKeyError(
    'The JUPITERONE_API_KEY environment variable must be set',
  );
}
