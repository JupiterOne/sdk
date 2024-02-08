import {
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
} from '@jupiterone/integration-sdk-core';
import { Response } from 'node-fetch';

export type RateLimitErrorParams = ConstructorParameters<
  typeof IntegrationProviderAPIError
>[0] & {
  retryAfter: number;
};

interface RequestErrorParams {
  endpoint: string;
  response: Response;
  logger: IntegrationLogger;
  logErrorBody: boolean;
}

export class RetryableIntegrationProviderApiError extends IntegrationProviderAPIError {
  retryable = true;
}

export class RateLimitError extends IntegrationProviderAPIError {
  constructor(options: RateLimitErrorParams) {
    super(options);
    this.retryAfter = options.retryAfter;
  }
  retryAfter: number;
  retryable = true;
}

class HTTPResponseError extends Error {
  response: Response;
  constructor(response: Response) {
    super(`HTTP Error Response: ${response.status} ${response.statusText}`);
    this.response = response;
  }
}

export async function retryableRequestError({
  endpoint,
  response,
  logger,
  logErrorBody,
}: RequestErrorParams): Promise<RetryableIntegrationProviderApiError> {
  if (logErrorBody) {
    let errorBody: any;
    try {
      errorBody = await response.json();
      logger.error(
        { errBody: JSON.stringify(errorBody) },
        'Encountered error from API',
      );
    } catch (e) {
      // pass
    }
  }

  if (response.status === 429) {
    return new RateLimitError({
      cause: new HTTPResponseError(response),
      status: response.status,
      statusText: response.statusText,
      endpoint,
      retryAfter: Number(response.headers.get('retry-after')),
    });
  }

  return new RetryableIntegrationProviderApiError({
    cause: new HTTPResponseError(response),
    endpoint,
    status: response.status,
    statusText: response.statusText ?? response.status,
  });
}

export async function fatalRequestError({
  endpoint,
  response,
  logger,
  logErrorBody,
}: RequestErrorParams): Promise<IntegrationProviderAPIError> {
  if (logErrorBody) {
    let errorBody: any;
    try {
      errorBody = await response.json();
      logger.error(
        { errBody: JSON.stringify(errorBody) },
        'Encountered error from API',
      );
    } catch (e) {
      // pass
    }
  }

  const apiErrorOptions = {
    cause: new HTTPResponseError(response),
    endpoint,
    status: response.status,
    statusText: response.statusText ?? response.status,
  };
  if (response.status === 401) {
    return new IntegrationProviderAuthenticationError(apiErrorOptions);
  } else if (response.status === 403) {
    return new IntegrationProviderAuthorizationError(apiErrorOptions);
  } else {
    return new IntegrationProviderAPIError(apiErrorOptions);
  }
}

/**
 * Function for determining if a request is retryable
 * based on the returned status.
 */
export function isRetryableRequest({ status }: Response): boolean {
  return (
    // 5xx error from provider (their fault, might be retryable)
    // 429 === too many requests, we got rate limited so safe to try again
    status >= 500 || status === 429
  );
}
