import fetch from 'node-fetch';
import { APIResponse, APIRequest, APIRequestOptions } from './types';
import { APIError } from './errors';
export type APIResourceIterationCallback<T> = (
  resources: T[],
) => boolean | void | Promise<boolean | void>;
import { resolveOptions, retiresAvailable } from './util';
import { DEFAULT_REQUEST_OPTIONS } from './defaults';

export class APIClient {
  // TODO (adam-in-ict) make rateLimitConfig configurable and only use the default values when none are provided

  async executeAPIRequest(
    request: APIRequest,
    options?: APIRequestOptions,
  ): Promise<APIResponse> {
    // If no options are provided, use the default options
    const resolvedOptions =
      options === undefined
        ? DEFAULT_REQUEST_OPTIONS
        : resolveOptions(options, DEFAULT_REQUEST_OPTIONS);
    let retryable: boolean = false;

    let response: Response;
    do {
      response = await fetch(request.url, request);
      try {
        if (!response.ok) {
          throw new APIError({
            message: `${response.status} ${response.statusText}`,
            status: response.status,
            statusText: response.statusText,
            endpoint: request.url,
            response: response,
          });
        }

        return {
          data: await response.json(),
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        };
      } catch (err) {
        const { isRetryable, currentAttempt, maxAttempts } =
          resolvedOptions.retryConfig;

        // Not handling the FetchError currently
        resolvedOptions.retryConfig.currentAttempt += 1;
        if (retiresAvailable(currentAttempt, maxAttempts)) {
          if (err instanceof APIError) {
            retryable = isRetryable(err);
          } else {
            throw new APIError({
              message: err.message,
              status: err.status,
              statusText: err.statusText,
              endpoint: request.url,
            });
          }
        } else {
          throw new APIError({
            message: `Could not complete request within ${resolvedOptions.retryConfig.maxAttempts} attempts!`,
            status: response.status,
            statusText: response.statusText,
            endpoint: request.url,
          });
        }
      }
    } while (retryable);
    throw new APIError({
      message: `${request.method} ${request.url}: ${response.status} ${response.statusText}`,
      status: response.status,
      statusText: response.statusText,
      endpoint: request.url,
      response: response,
    });
  }
}
