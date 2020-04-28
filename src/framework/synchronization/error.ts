import { IntegrationError } from '../execution/error';

export class IntegrationMalformedApiKeyError extends Error
  implements IntegrationError {
  code = 'MalformedApiKeyError';
}

export class IntegrationInstanceNotFound extends Error
  implements IntegrationError {
  code = 'IntegrationInstanceNotFound';
}

export class IntegrationUnexpectedSynchronizationError extends Error
  implements IntegrationError {
  code = 'UnexpectedSynchronizationError';
}

export function unexpectedSynchronizationError(code: string, message: string) {
  return new IntegrationUnexpectedSynchronizationError(
    `Unexpected error occurred (code=${code} message="${message}").`,
  );
}

export function integrationInstanceNotFoundError(
  integrationInstanceId: string,
) {
  return new IntegrationInstanceNotFound(
    `Integration instance was not found (id=${integrationInstanceId}).`,
  );
}
