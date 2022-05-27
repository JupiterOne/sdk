import fetch from 'node-fetch';
import { APIResponse, APIRequest, APIRequestOptions } from './types';
import { APIError } from './errors';
export type APIResourceIterationCallback<T> = (
  resources: T[],
) => boolean | void | Promise<boolean | void>;
import { DEFAULT_REQUEST_OPTIONS } from './defaults';

export class APIClient {
  // TODO (adam-in-ict) make rateLimitConfig configurable and only use the default values when none are provided

  async executeAPIRequest(
    request: APIRequest,
    options?: APIRequestOptions,
  ): Promise<APIResponse> {
    // TODO: Need a better way to resolve options specified in constructor,
    // request, and defaults
    const resolvedOptions = {
      rateLimitConfig:
        options?.rateLimitConfig === undefined
          ? DEFAULT_REQUEST_OPTIONS.rateLimitConfig!
          : options.rateLimitConfig,
      errorHandler:
        options?.errorHandler === undefined
          ? DEFAULT_REQUEST_OPTIONS.errorHandler!
          : options.errorHandler,
      isRetryable:
        options?.isRetryable === undefined
          ? DEFAULT_REQUEST_OPTIONS.isRetryable!
          : options.isRetryable,
    };

    let attempts = 0;
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
        await resolvedOptions.errorHandler(request, response);
      }
      attempts += 1;
    } while (resolvedOptions.isRetryable(attempts, request, response));

    throw new APIError({
      message: `Could not complete request within ${attempts} attempts!`,
      status: response.status,
      statusText: response.statusText,
      endpoint: request.url,
    });
  }
}
