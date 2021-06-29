import { AxiosError } from 'axios';

import { IntegrationError } from '@jupiterone/integration-sdk-core';
import { SynchronizationApiErrorResponse } from './types';

export function synchronizationApiError(
  err: AxiosError<SynchronizationApiErrorResponse>,
  errorMessage: string,
) {
  if (err.response?.data?.error) {
    // Looks like Axios error response with data
    const responseData: SynchronizationApiErrorResponse = err.response.data;
    const code = responseData!.error!.code || err.response.status;
    const message = responseData!.error!.message || err.response.statusText;

    return new IntegrationError({
      code: 'SYNCHRONIZATION_API_RESPONSE_ERROR',
      message: `${errorMessage} (API response: code=${
        code || '<none>'
      }, message="${message || '<none>'}").`,
    });
  } else {
    return new IntegrationError({
      code: 'UNEXPECTED_SYNCRONIZATION_ERROR',
      message: errorMessage,
      cause: err,
    });
  }
}
