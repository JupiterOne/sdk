import {
  IntegrationLogger,
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
} from '@jupiterone/integration-sdk-core';
import { Response } from 'node-fetch';

type RateLimitErrorParams = ConstructorParameters<
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

export class RateLimitError extends RetryableIntegrationProviderApiError {
  constructor(options: RateLimitErrorParams) {
    super(options);
    this.retryAfter = options.retryAfter;
  }
  retryAfter: number;
}

export class ResponseBodyError extends Error {
  bodyError: string;
  constructor(bodyError: string) {
    super(`Error Response: ${bodyError}`);
    this.name = 'ResponseBodyError';
    this.bodyError = bodyError;
  }
}

async function getErrorBody(
  response: Response,
  logger: IntegrationLogger,
  logErrorBody: boolean,
) {
  let errorBody: string | undefined;
  try {
    const clonedResponse = response.clone();
    errorBody = await clonedResponse.text();
    if (logErrorBody) {
      logger.error({ errBody: errorBody }, 'Encountered error from API');
    }
  } catch (e) {
    // pass
  }
  return errorBody;
}

export async function retryableRequestError({
  endpoint,
  response,
  logger,
  logErrorBody,
}: RequestErrorParams): Promise<RetryableIntegrationProviderApiError> {
  const errorBody = await getErrorBody(response, logger, logErrorBody);

  if (response.status === 429) {
    return new RateLimitError({
      cause: errorBody ? new ResponseBodyError(errorBody) : undefined,
      status: response.status,
      statusText: response.statusText,
      endpoint,
      retryAfter: Number(response.headers.get('retry-after')),
    });
  }

  return new RetryableIntegrationProviderApiError({
    cause: errorBody ? new ResponseBodyError(errorBody) : undefined,
    endpoint,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function fatalRequestError({
  endpoint,
  response,
  logger,
  logErrorBody,
}: RequestErrorParams): Promise<IntegrationProviderAPIError> {
  const errorBody = await getErrorBody(response, logger, logErrorBody);

  const apiErrorOptions = {
    cause: errorBody ? new ResponseBodyError(errorBody) : undefined,
    endpoint,
    status: response.status,
    statusText: response.statusText,
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
export function isRetryableRequest(status: number): boolean {
  return (
    // 5xx error from provider (their fault, might be retryable)
    // 429 === too many requests, we got rate limited so safe to try again
    status >= 500 || status === 429
  );
}
