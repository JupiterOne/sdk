import { APIError } from './errors';
import {
  APIRequestOptions,
  ErrorHandlerFunction,
  IsRetryableFunction,
  RateLimitConfig,
  RetryConfig,
} from './types';
import { handleRateLimitError, isRetryableStatusCode } from './util';

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

export const defaultIsRetryable: IsRetryableFunction = (request, response) => {
  if (isRetryableStatusCode(response.status)) {
    return true;
  } else {
    return false;
  }
};
