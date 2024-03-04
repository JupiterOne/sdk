import fetch, { Headers, Response } from 'node-fetch';
import {
  IntegrationError,
  IntegrationLogger,
  IntegrationProviderAPIError,
} from '@jupiterone/integration-sdk-core';
import { AttemptContext, retry, sleep } from '@lifeomic/attempt';
import {
  fatalRequestError,
  isRetryableRequest,
  retryableRequestError,
} from './errors';
import {
  ClientConfig,
  OptionalPromise,
  RetryOptions,
  RequestOptions,
  RateLimitThrottlingOptions,
  RateLimitHeaders,
  IterateCallbackResult,
  TokenBucketOptions,
  NextPageData,
} from './types';
import get from 'lodash/get';
import { HierarchicalTokenBucket } from '@jupiterone/hierarchical-token-bucket';

export const defaultErrorHandler = async (
  err: any,
  context: AttemptContext,
  logger: IntegrationLogger,
) => {
  if (err.code === 'ECONNRESET' || err.message.includes('ECONNRESET')) {
    return;
  }

  if (!err.retryable) {
    // can't retry this? just abort
    context.abort();
    return;
  }

  if (err.status === 429) {
    const retryAfter = err.retryAfter ? err.retryAfter * 1000 : 5_000;
    logger.warn(
      { retryAfter },
      'Received a rate limit error. Waiting before retrying.',
    );
    await sleep(retryAfter);
  }
};

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 30_000,
  timeout: 180_000,
  factor: 2, // exponential backoff factor. with 30 sec start and 3 attempts, longest wait is 2 min
  handleError: defaultErrorHandler,
};

const DEFAULT_RATE_LIMIT_HEADERS: { [key in keyof RateLimitHeaders]: string } =
  {
    limit: 'ratelimit-limit',
    remaining: 'ratelimit-remaining',
    reset: 'ratelimit-reset',
  };

export abstract class BaseAPIClient {
  protected baseUrl: string;
  protected logger: IntegrationLogger;
  protected retryOptions: RetryOptions;
  protected logErrorBody: boolean;
  protected rateLimitThrottling: RateLimitThrottlingOptions | undefined;
  protected baseTokenBucket?: HierarchicalTokenBucket;
  protected tokenBucketInitialConfig?: TokenBucketOptions | undefined;
  protected endpointTokenBuckets: Record<string, HierarchicalTokenBucket> = {};

  /**
   * The authorization headers for the API requests
   */
  protected authorizationHeaders: Record<string, string>;

  /**
   * Create a new API client
   *
   * @param {ClientConfig} config - The configuration for the client
   * @param {string} config.baseUrl - The base URL for the API
   * @param {IntegrationLogger} config.logger - The logger to use
   * @param {Partial<RetryOptions>} [config.retryOptions] - The retry options for the client,
   *     if not provided, the default retry options will be used
   * @param {boolean} [config.logErrorBody] - Whether to log the error body,
   *     if true, the error body will be logged when a request fails
   * @param {RateLimitThrottlingOptions} [config.rateLimitThrottling] - The rate limit throttling options,
   *     if not provided, rate limit throttling will not be enabled
   * @param {number} [config.rateLimitThrottling.threshold] - The threshold at which to throttle requests
   *   It uses the Rate Limit header fields standard by default: https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-07.html
   * @param {string} [config.rateLimitThrottling.resetMode='remaining_epoch_s'] - The mode to use for rate limit reset,
   *    - 'remaining_epoch_s' - Use when reset header has the remaining window before the rate limit resets, in UTC epoch seconds.
   *    - 'datetime_epoch_s' - Use when reset header has the time at which the current rate limit window resets in UTC epoch seconds.
   * @param {RateLimitHeaders} [config.rateLimitThrottling.rateLimitHeaders] - The headers to use for rate limiting
   * @param {string} [config.rateLimitThrottling.rateLimitHeaders.limit='ratelimit-limit'] - The header for the rate limit limit
   * @param {string} [config.rateLimitThrottling.rateLimitHeaders.remaining='ratelimit-remaining'] - The header for the rate limit remaining
   * @param {string} [config.rateLimitThrottling.rateLimitHeaders.reset='ratelimit-reset'] - The header for the rate limit reset
   * @param {TokenBucketOptions} [config.tokenBucket] - The token bucket options,
   *    if not provided, token bucket will not be enabled
   *
   * @example
   * ```typescript
   * const client = new APIClient({
   *   baseUrl: 'https://api.example.com',
   *   logger: context.logger,
   *   rateLimitThrottling: {
   *     threshold: 0.3,
   *     rateLimitHeaders: {
   *       limit: 'x-ratelimit-limit',
   *       remaining: 'x-ratelimit-remaining',
   *       reset: 'x-ratelimit-reset',
   *     },
   *   },
   * })
   *  ```
   */
  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      ...config.retryOptions,
    };
    this.logErrorBody = config.logErrorBody ?? false;
    this.rateLimitThrottling = config.rateLimitThrottling;
    if (this.rateLimitThrottling && !this.rateLimitThrottling.resetMode) {
      // Set default resetMode
      this.rateLimitThrottling.resetMode = 'remaining_epoch_s';
    }
    if (config.tokenBucket) {
      this.tokenBucketInitialConfig = config.tokenBucket;
      this.baseTokenBucket = new HierarchicalTokenBucket({
        maximumCapacity: config.tokenBucket.maximumCapacity,
        refillRate: config.tokenBucket.refillRate,
      });
    }
  }

  protected withBaseUrl(endpoint: string): string {
    return new URL(endpoint, this.baseUrl).toString();
  }

  /**
   * Get the authorization headers for the API requests.
   *
   * @return {Promise<Record<string, string>>} - The authorization headers
   *
   * @example
   * ```typescript
   * async getAuthorizationHeaders(): Record<string, string> {
   *   return {
   *     Authorization: `Bearer ${this.config.apiKey}`,
   *   };
   * }
   * ```
   * @example
   * ```typescript
   * protected async getAuthorizationHeaders(): Promise<Record<string, string>> {
   *   const response = await this.request('/token', {
   *     method: 'POST',
   *     body: {
   *       email: this.config.email,
   *       password: this.config.password,
   *     },
   *     authorize: false, // don't try to do authorization on this request, it will go into an infinite loop.
   *   });
   *   const data = await response.json();
   *   return {
   *     Authorization: `Bearer ${data.token}`,
   *   };
   * }
   */
  protected abstract getAuthorizationHeaders(): OptionalPromise<
    Record<string, string>
  >;

  /**
   * Perform a request to the API.
   *
   * @param {string} endpoint - The endpoint to request
   * @param {RequestOptions} options - The options for the request
   * @param {string} [options.method=GET] - The HTTP method to use
   * @param {Record<string, unknown>} [options.body] - The body of the request
   * @param {Record<string, string>} [options.headers] - The headers for the request
   * @param {boolean} [options.authorize=true] - Whether to include authorization headers
   * @return {Promise<Response>} - The response from the API
   */
  protected async request(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<Response> {
    const tokenBucket = this.getTokenBucket(endpoint, options?.bucketTokens);
    if (tokenBucket) {
      const timeToWaitInMs = tokenBucket.take();
      await sleep(timeToWaitInMs);
    }

    const { method = 'GET', body, headers, authorize = true } = options ?? {};
    if (authorize && !this.authorizationHeaders) {
      this.authorizationHeaders = await this.getAuthorizationHeaders();
    }
    let url: string | undefined;
    try {
      url = new URL(endpoint).toString();
    } catch (e) {
      // If the path is not a valid URL, assume it's a path and prepend the base URL
      url = this.withBaseUrl(endpoint);
    }
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authorize && this.authorizationHeaders),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response;
  }

  /**
   * Perform a request to the API with retries and error handling.
   *
   * @param {string} endpoint - The endpoint path to request
   * @param {RequestOptions} options - The options for the request
   * @param {string} [options.method=GET] - The HTTP method to use
   * @param {Record<string, unknown>} [options.body] - The body of the request
   * @param {Record<string, string>} [options.headers] - The headers for the request
   * @param {boolean} [options.authorize=true] - Whether to include authorization headers
   * @return {Promise<Response>} - The response from the API
   */
  protected async retryableRequest(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<Response> {
    const { method = 'GET', body, headers, authorize = true } = options ?? {};
    return retry(
      async () => {
        return this.withRateLimiting(async () => {
          let response: Response | undefined;
          try {
            response = await this.request(endpoint, {
              method,
              body,
              headers,
              authorize,
            });
          } catch (err) {
            this.logger.error(
              { code: err.code, err, endpoint },
              'Error sending request',
            );
            throw err;
          }

          if (response.ok) {
            return response;
          }

          let error: IntegrationProviderAPIError | undefined;
          const requestErrorParams = {
            endpoint,
            response,
            logger: this.logger,
            logErrorBody: this.logErrorBody,
          };
          if (isRetryableRequest(response.status)) {
            error = await retryableRequestError(requestErrorParams);
          } else {
            error = await fatalRequestError(requestErrorParams);
          }
          for await (const _chunk of response.body) {
            // force consumption of body to avoid memory leaks
            // https://github.com/node-fetch/node-fetch/issues/83
          }
          throw error;
        });
      },
      {
        maxAttempts: this.retryOptions.maxAttempts,
        delay: this.retryOptions.delay,
        timeout: this.retryOptions.timeout,
        factor: this.retryOptions.factor,
        handleError: async (err, context) => {
          await this.retryOptions.handleError(err, context, this.logger);
        },
      },
    );
  }

  /**
   * Iteratively performs API requests based on the initial request and subsequent requests defined by a callback function.
   * This method is designed to facilitate paginated API requests where each request's response determines the parameters of the next request.
   *
   * @param {object} initialRequest - The initial request parameters
   * @param {string} initialRequest.endpoint - The endpoint path to request
   * @param {RequestOptions} [initialRequest.options] - The options for the request
   * @param {string|string[]|undefined} dataPath - The path to the data in the response to iterate over
   * @param {function} nextPageCallback - The callback function to determine the parameters of the next request
   *
   * @return {AsyncGenerator<T, void, unknown>} - An async generator that yields the items from the paginated requests
   *
   * @example
   * ```typescript
   * async iterateUsers(iteratee: (user: User) => Promise<void>): Promise<void>{
   *   const baseEndpoint = '/users?limit=100';
   *   const iterator = this.paginate({
   *     endpoint: baseEndpoint,
   *   }, 'users', this.getNextPageCallback(baseEndpoint));
   *
   *   for await (const user of iterator) {
   *     await iteratee(user);
   *   }
   * };
   *
   * private getNextPageCallback(baseEndpoint: string) {
   *   return (data: NextPageData): IterateCallbackResult | undefined => {
   *     const { body } = data;
   *     const nextCursor = body.metadata?.cursor;
   *     if (!nextCursor) {
   *       return;
   *     }
   *     const nextUrl = `${baseEndpoint}&cursor=${nextCursor}`;
   *     return {
   *       nextUrl,
   *     };
   *   }
   * };
   * ```
   */
  protected async *paginate<T>(
    initialRequest: {
      endpoint: string;
      options?: RequestOptions;
    },
    dataPath: string | string[] | undefined,
    nextPageCallback: (data: NextPageData) => IterateCallbackResult | undefined,
  ): AsyncGenerator<T, void, unknown> {
    let nextUrl: string | undefined;
    let nextRequestOptions: RequestOptions | undefined;
    let isInitialRequest = true;

    do {
      const response = await this.retryableRequest(
        isInitialRequest ? initialRequest.endpoint : (nextUrl as string),
        isInitialRequest ? initialRequest.options : nextRequestOptions,
      );
      if (response.status === 204) {
        break;
      }

      const data = await response.json();

      let items = dataPath ? get(data, dataPath) : data;
      items = Array.isArray(items) ? items : [];
      for (const item of items) {
        yield item as T;
      }

      const cbOptions = nextPageCallback({
        body: data,
        headers: response.headers.raw(),
      });

      nextUrl = cbOptions?.nextUrl;
      nextRequestOptions = cbOptions?.nextRequestOptions;
      isInitialRequest = false;
    } while (nextUrl);
  }

  /**
   * Get the token bucket for the given endpoint
   *
   * @param {string} endpoint - The endpoint to get the token bucket for
   * @param {number} [tokens] - The number of tokens to use for the token bucket
   */
  private getTokenBucket(
    endpoint: string,
    tokens?: number,
  ): HierarchicalTokenBucket | undefined {
    if (!this.baseTokenBucket) {
      return;
    }
    const path = endpoint.split('?')[0];
    if (this.endpointTokenBuckets[path]) {
      return this.endpointTokenBuckets[path];
    }
    this.endpointTokenBuckets[path] = new HierarchicalTokenBucket({
      parent: this.baseTokenBucket,
      maximumCapacity:
        tokens ?? this.tokenBucketInitialConfig?.maximumCapacity ?? 10_000,
      refillRate: tokens ?? this.tokenBucketInitialConfig?.refillRate ?? 10_000,
    });
    return this.endpointTokenBuckets[path];
  }

  /**
   * Wait until the rate limit reset time before sending the next request
   * if the rate limit threshold is exceeded.
   *
   * @param {function} fn - The function to rate limit
   * @return {Promise<Response>}
   */
  protected async withRateLimiting(
    fn: () => Promise<Response>,
  ): Promise<Response> {
    const response = await fn();
    if (!this.rateLimitThrottling) {
      return response;
    }
    const { rateLimitLimit, rateLimitRemaining } = this.parseRateLimitHeaders(
      response.headers,
    );
    if (
      this.shouldThrottleNextRequest({
        rateLimitLimit,
        rateLimitRemaining,
        threshold: this.rateLimitThrottling.threshold,
      })
    ) {
      const timeToSleepInMs = this.getRetryDelayMs(response.headers);
      const thresholdPercentage = this.rateLimitThrottling.threshold * 100;
      const resetHeaderName =
        this.rateLimitThrottling.rateLimitHeaders?.reset ??
        'x-rate-limit-reset';

      this.logger.warn(
        { rateLimitLimit, rateLimitRemaining, timeToSleepInMs },
        `Exceeded ${thresholdPercentage}% of rate limit. Sleeping until ${resetHeaderName}`,
      );
      await sleep(timeToSleepInMs);
    }
    return response;
  }

  private parseRateLimitHeaders(headers: Headers): {
    rateLimitLimit: number | undefined;
    rateLimitRemaining: number | undefined;
  } {
    const strRateLimitLimit = this.getRateLimitHeaderValue(headers, 'limit');
    const strRateLimitRemaining = this.getRateLimitHeaderValue(
      headers,
      'remaining',
    );
    return {
      rateLimitLimit: strRateLimitLimit
        ? parseInt(strRateLimitLimit, 10)
        : undefined,
      rateLimitRemaining: strRateLimitRemaining
        ? parseInt(strRateLimitRemaining, 10)
        : undefined,
    };
  }

  /**
   * Determine if the next request should be throttled based on the rate limit headers
   *
   * @param {object} params - The parameters for the function
   * @param {number|undefined} params.rateLimitLimit - The rate limit limit
   * @param {number|undefined} params.rateLimitRemaining - The rate limit remaining
   * @param {number} params.threshold - The threshold at which to throttle requests
   * @return {boolean} - Whether the next request should be throttled
   */
  private shouldThrottleNextRequest(params: {
    rateLimitLimit: number | undefined;
    rateLimitRemaining: number | undefined;
    threshold: number;
  }): boolean {
    const { rateLimitLimit, rateLimitRemaining } = params;
    if (rateLimitLimit === undefined || rateLimitRemaining === undefined)
      return false;

    const rateLimitConsumed = rateLimitLimit - rateLimitRemaining;
    return rateLimitConsumed / rateLimitLimit > params.threshold;
  }

  /**
   * Determine wait time by getting the delta X-Rate-Limit-Reset and the Date header
   * Add 1 second to account for sub second differences between the clocks that create these headers
   */
  private getRetryDelayMs(headers: Headers) {
    const resetValue = this.getRateLimitHeaderValue(headers, 'reset');
    if (!resetValue) {
      // If the header is not present, we can't determine the wait time, so we'll just wait 60 seconds
      return 60_000;
    }
    if (this.rateLimitThrottling?.resetMode === 'remaining_epoch_s') {
      return parseInt(resetValue, 10) * 1000 + 1000; // add one second to make sure the reset time has passed
    } else if (this.rateLimitThrottling?.resetMode === 'datetime_epoch_s') {
      const nowDate = new Date(headers.get('date') ?? Date.now());
      const retryDate = new Date(parseInt(resetValue, 10) * 1000);
      return retryDate.getTime() - nowDate.getTime() + 1000; // add one second to make sure the reset time has passed
    } else {
      throw new IntegrationError({
        code: 'INVALID_RATE_LIMIT_RESET_MODE',
        message: 'Invalid rate limit reset mode',
      });
    }
  }

  private getRateLimitHeaderValue(
    headers: Headers,
    header: keyof RateLimitHeaders,
  ) {
    return headers.get(
      this.rateLimitThrottling?.rateLimitHeaders?.[header] ??
        DEFAULT_RATE_LIMIT_HEADERS[header],
    );
  }
}
