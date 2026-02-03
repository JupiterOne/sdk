import { IntegrationError } from '@jupiterone/integration-sdk-core';
import { SynchronizationApiErrorResponse } from './types';

/**
 * Error structure from RequestClient that contains response data
 */
interface RequestClientError {
  response?: {
    data?: SynchronizationApiErrorResponse;
    status?: number;
    statusText?: string;
  };
}

export function synchronizationApiError(err: unknown, errorMessage: string) {
  const requestError = err as RequestClientError;
  if (requestError?.response?.data?.error) {
    // Looks like RequestClient error response with data
    const responseData: SynchronizationApiErrorResponse =
      requestError.response.data;
    const code = responseData!.error!.code || requestError.response.status;
    const message =
      responseData!.error!.message || requestError.response.statusText;

    return new IntegrationError({
      code: 'SYNCHRONIZATION_API_RESPONSE_ERROR',
      message: `${errorMessage} (API response: code=${
        code || '<none>'
      }, message="${message || '<none>'}").`,
    });
  } else {
    return new IntegrationError({
      code: 'UNEXPECTED_SYNCHRONIZATION_ERROR',
      message: errorMessage,
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
}
