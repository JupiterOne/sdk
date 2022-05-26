import fetch from 'node-fetch';
import { handleRateLimitError, isRetryableStatusCode } from './util';
import { RateLimitConfig, APIResponse, APIRequest } from './types';
import { APIError } from './errors';

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  reserveLimit: 30,
  cooldownPeriod: 1000,
  sleepAdditionalSeconds: 0,
};

export type APIResourceIterationCallback<T> = (
  resources: T[],
) => boolean | void | Promise<boolean | void>;

export type isRetryableFunction = (
  retries: number,
  request: APIRequest,
  response: Response,
) => boolean;

const defaultIsRetryable: isRetryableFunction = (
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

export type APIErrorHandlerFunction = (
  request: APIRequest,
  response: Response,
) => Promise<void> | void;

const defaultErrorHandler: APIErrorHandlerFunction = async (
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

export class APIClient {
  // TODO (adam-in-ict) make rateLimitConfig configurable and only use the default values when none are provided

  async executeAPIRequest(
    request: APIRequest,
    errorHandler?: APIErrorHandlerFunction,
    isRetryable?: isRetryableFunction,
  ): Promise<APIResponse> {
    let attempts = 0;

    errorHandler =
      errorHandler === undefined ? defaultErrorHandler : errorHandler;

    isRetryable = isRetryable === undefined ? defaultIsRetryable : isRetryable;

    let response: Response;
    do {
      response = await fetch(request.url, request);

      if (response.ok) {
        return {
          // Will we always get json data?
          data: await response.json(),
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        };
      } else {
        await errorHandler(request, response);
      }
      attempts += 1;
    } while (isRetryable(attempts, request, response));

    throw new APIError({
      message: `Could not complete request within ${attempts} attempts!`,
      status: response.status,
      statusText: response.statusText,
      endpoint: request.url,
    });
  }
}
