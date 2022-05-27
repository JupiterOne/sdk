import { APIError } from './errors';
import {
  APIRequestOptions,
  ErrorHandlerFunction,
  IsRetryableFunction,
  RateLimitConfig,
} from './types';
import { handleRateLimitError, isRetryableStatusCode } from './util';

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  reserveLimit: 30,
  cooldownPeriod: 1000,
  sleepAdditionalSeconds: 0,
};

export const defaultErrorHandler: ErrorHandlerFunction = async (
  request,
  response,
) => {
  if (response.status === 429) {
    await handleRateLimitError(response.headers, DEFAULT_RATE_LIMIT_CONFIG);
  } else if (
    (response.status >= 400 && response.status !== 408) ||
    response.status === 501
  ) {
    throw new APIError({
      message: `${request.method} ${request.url}: ${response.status} ${response.statusText}`,
      status: response.status,
      statusText: response.statusText,
      endpoint: request.url,
    });
  }
};

export const defaultIsRetryable: IsRetryableFunction = (
  retries,
  request,
  response,
) => {
  if (retries <= 4 && isRetryableStatusCode(response.status)) {
    return true;
  } else {
    return false;
  }
};

export const DEFAULT_REQUEST_OPTIONS: APIRequestOptions = {
  rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
  errorHandler: defaultErrorHandler,
  isRetryable: defaultIsRetryable,
};
