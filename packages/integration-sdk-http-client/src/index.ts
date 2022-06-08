import fetch from 'node-fetch';
import {
  APIResponse,
  APIRequest,
  APIRequestOptions,
  RetryConfig,
  RateLimitConfig,
} from './types';
import { APIError } from './errors';
export type APIResourceIterationCallback<T> = (
  resources: T[],
) => boolean | void | Promise<boolean | void>;
import { retiresAvailable } from './util';
import { defaultIsRetryable } from './defaults';

type ResolvedAPIRequestOptions = {
  retryConfig: Required<RetryConfig>;
  rateLimitConfig: Required<RateLimitConfig>;
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  reserveLimit: 30,
  cooldownPeriod: 1000,
  sleepAdditionalSeconds: 0,
};

export const DEFAULT_REQUEST_OPTIONS: ResolvedAPIRequestOptions = {
  rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
  retryConfig: {
    isRetryable: defaultIsRetryable,
    maxAttempts: 5 as const,
    currentAttempt: 0,
  },
};

export class APIClient {
  // TODO (adam-in-ict) make rateLimitConfig configurable and only use the default values when none are provided

  async executeAPIRequest(
    request: APIRequest,
    options?: APIRequestOptions,
  ): Promise<APIResponse> {
    // TODO: Need a better way to resolve options specified in constructor,
    // request, and defaults
    const resolvedOptions: ResolvedAPIRequestOptions = {
      rateLimitConfig:
        options?.rateLimitConfig === undefined
          ? DEFAULT_REQUEST_OPTIONS.rateLimitConfig
          : options.rateLimitConfig,
      retryConfig: {
        currentAttempt:
          options?.retryConfig?.currentAttempt ??
          DEFAULT_REQUEST_OPTIONS.retryConfig.currentAttempt,
        maxAttempts:
          options?.retryConfig?.maxAttempts ??
          DEFAULT_REQUEST_OPTIONS.retryConfig.maxAttempts,
        isRetryable:
          options?.retryConfig?.isRetryable ??
          DEFAULT_REQUEST_OPTIONS.retryConfig.isRetryable,
      },
    };

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
      }
      resolvedOptions.retryConfig.currentAttempt += 1;
    } while (
      retiresAvailable(
        resolvedOptions.retryConfig.currentAttempt,
        resolvedOptions.retryConfig.maxAttempts,
      ) &&
      resolvedOptions.isRetryable(request, response)
    );

    throw new APIError({
      message: `Could not complete request within ${attempts} attempts!`,
      status: response.status,
      statusText: response.statusText,
      endpoint: request.url,
    });
  }
}
