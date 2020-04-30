import { IntegrationError } from '../../errors';
import { AxiosError } from 'axios';
import { SynchronizatoinApiErrorResponse } from './types';

export class IntegrationMalformedApiKeyError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'MalformedApiKeyError',
      message,
    });
  }
}

export class IntegrationInstanceNotFound extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'IntegrationInstanceNotFound',
      message,
    });
  }
}

export function synchronizationApiError(
  err: AxiosError<SynchronizatoinApiErrorResponse>,
  errorMessage: string,
) {
  if (err.response?.data?.error) {
    // Looks like Axios error response with data
    const responseData: SynchronizatoinApiErrorResponse = err.response.data;
    const { code, message } = responseData!.error!;
    return new IntegrationError({
      code: 'SyncronizationApiResponseError',
      message: `${errorMessage} (API response: code=${
        code || '<none>'
      }, message="${message || '<none>'}").`,
    });
  } else {
    return new IntegrationError({
      code: 'UnexpectedSyncronizationError',
      message: errorMessage,
      cause: err,
    });
  }
}
