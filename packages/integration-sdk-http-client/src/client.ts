import { join as joinPath } from 'node:path/posix';
import fetch, { Headers, Response } from 'node-fetch';
import {
  IntegrationError,
  IntegrationInstanceConfig,
  IntegrationLogger,
  IntegrationProviderAPIError,
} from '@jupiterone/integration-sdk-core';
import {
  AttemptContext,
  AttemptOptions,
  defaultCalculateDelay,
  retry,
  sleep,
} from '@lifeomic/attempt';
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
  RefreshAuthOptions,
} from './types';
import get from 'lodash/get';
import { HierarchicalTokenBucket } from '@jupiterone/hierarchical-token-bucket';
import FormData from 'form-data';
import { Agent } from 'http';
import https from 'node:https';

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 30_000,
  timeout: 180_000,
  timeoutMaxAttempts: 3,
  factor: 2, // exponential backoff factor. with 30 sec start and 3 attempts, longest wait is 2 min
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
  protected refreshAuth?: RefreshAuthOptions;

  protected readonly integrationConfig: IntegrationInstanceConfig;
  protected readonly agent?: Agent;

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
   * @param {boolean} [config.refreshAuth.enabled] - If true, the auth headers will be refreshed on 401 and 403 errors
   * @param {number[]} [config.refreshAuth.errorCodes] - If provided, the auth headers will be refreshed on the provided error codes
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
    this.integrationConfig = config.integrationConfig;
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
    this.refreshAuth = config.refreshAuth;
  }

  protected withBaseUrl(endpoint: string): string {
    const url = new URL(this.baseUrl);
    url.pathname = joinPath(url.pathname, endpoint);
    return decodeURIComponent(url.toString());
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
   * Returns a default agent to be used along with the http requests, depending
   * on the integration configurations.
   * @returns {Agent | undefined} - The default agent for the API requests
   */
  protected getDefaultAgent(): Agent | undefined {
    const integrationHasAgentConfigs =
      this.integrationConfig.caCertificate ||
      this.integrationConfig.disableTlsVerification;

    return integrationHasAgentConfigs
      ? new https.Agent({
          ca: this.integrationConfig.caCertificate,
          rejectUnauthorized: !this.integrationConfig.disableTlsVerification,
        })
      : undefined;
  }

  /**
   * Perform a request to the API.
   *
   * @param {string} endpoint - The endpoint to request
   * @param {RequestOptions} options - The options for the request
   * @param {string} [options.method=GET] - The HTTP method to use
   * @param {'json' | 'form'} [options.bodyType='json'] - Specify how the body object should be sent to the server
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

    const {
      method = 'GET',
      body,
      bodyType = 'json',
      headers,
      authorize = true,
      agent,
    } = options ?? {};
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

    let fmtBody: string | FormData | URLSearchParams | undefined;
    if (body) {
      if (bodyType === 'form') {
        fmtBody = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          if (typeof value !== 'string') {
            throw new IntegrationError({
              code: 'INVALID_FORM_DATA',
              message: 'Form data values must be strings',
            });
          }
          (fmtBody as FormData).append(key, value);
        });
      } else if (bodyType === 'text' && typeof body === 'string') {
        fmtBody = body;
      } else if (bodyType === 'urlencoded') {
        fmtBody = new URLSearchParams();
        Object.entries(body).forEach(([key, value]) => {
          if (typeof value !== 'string') {
            throw new IntegrationError({
              code: 'INVALID_FORM_DATA',
              message: 'Form values must be strings',
            });
          }
          (fmtBody as URLSearchParams).append(key, value);
        });
      } else {
        fmtBody = JSON.stringify(body);
      }
    }
    const response = await fetch(url, {
      method,
      headers: {
        ...(bodyType === 'json' && { 'Content-Type': 'application/json' }),
        ...(bodyType === 'form' && (fmtBody as FormData).getHeaders()),
        ...(bodyType === 'text' && { 'Content-Type': 'text/plain' }),
        ...(bodyType === 'urlencoded' && {
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
        Accept: 'application/json',
        ...(authorize && this.authorizationHeaders),
        ...headers,
      },
      body: fmtBody,
      agent: agent ?? this.getDefaultAgent(),
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
    const doRequest = async (timeoutRetryAttempt = 0) => {
      return retry(
        async () => {
          return this.withRateLimiting(async () => {
            let response: Response | undefined;
            try {
              response = await this.request(endpoint, options);
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
            if (response.body) {
              for await (const _chunk of response.body) {
                // force consumption of body to avoid memory leaks
                // https://github.com/node-fetch/node-fetch/issues/83
              }
            }
            throw error;
          });
        },
        {
          maxAttempts: this.retryOptions.maxAttempts,
          delay: this.retryOptions.delay,
          timeout: this.retryOptions.timeout,
          factor: this.retryOptions.factor,
          calculateDelay: (context, options) => {
            return this.retryCalculateDelay(context, options);
          },
          handleError: async (err, context) => {
            if (this.retryOptions.handleError) {
              await this.retryOptions.handleError(err, context, this.logger);
            } else {
              await this.retryErrorHandler(err, context);
            }
          },
          handleTimeout: async (attemptContext, options) => {
            if (timeoutRetryAttempt < this.retryOptions.timeoutMaxAttempts) {
              this.logger.warn(
                {
                  attemptContext,
                  timeoutRetryAttempt,
                  link: endpoint,
                },
                'Hit a timeout, restarting request retry cycle.',
              );

              return await doRequest(++timeoutRetryAttempt);
            } else {
              this.logger.warn(
                {
                  attemptContext,
                  timeoutRetryAttempt,
                  link: endpoint,
                },
                'Hit a timeout during the final attempt. Unable to collect data for this query.',
              );
              const err: any = new Error(
                `Retry timeout (attemptNum: ${attemptContext.attemptNum}, timeout: ${options.timeout})`,
              );
              err.code = 'ATTEMPT_TIMEOUT';
              throw err;
            }
          },
        },
      );
    };
    return await doRequest();
  }

  protected async retryErrorHandler(err: any, context: AttemptContext) {
    if (
      ['ECONNRESET', 'ETIMEDOUT'].some(
        (code) => err.code === code || err.message.includes(code),
      )
    ) {
      return;
    }

    const refreshAuthErrorCodes = this.refreshAuth?.errorCodes ?? [401, 403];
    if (
      this.refreshAuth?.enabled &&
      refreshAuthErrorCodes.includes(err.status) &&
      context.attemptsRemaining > 1
    ) {
      this.logger.warn(
        'Encountered an authentication error. Refreshing authorization headers and retrying.',
      );
      this.authorizationHeaders = undefined as any;
      context.attemptsRemaining = 1;
      return;
    }

    if (!err.retryable) {
      // can't retry this? just abort
      context.abort();
      return;
    }

    if (err.status === 429) {
      const retryAfter = err.retryAfter ? err.retryAfter * 1000 : 5_000;
      this.logger.warn(
        { retryAfter },
        'Received a rate limit error. Waiting before retrying.',
      );
      await sleep(retryAfter);
    }
  }

  protected retryCalculateDelay<T>(
    context: AttemptContext,
    options: AttemptOptions<T>,
  ) {
    if (context.attemptNum === 0) {
      return 0; // don't wait before the first attempt
    }
    return defaultCalculateDelay(context, options);
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
      if (response.status === 204 && response.body) {
        for await (const _chunk of response.body) {
          // force consumption of body to avoid memory leaks
        }
        break;
      }

      const data = await this.parseResponseInPaginate(response);

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

  protected async parseResponseInPaginate(response: Response): Promise<any> {
    return response.json();
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
        this.rateLimitThrottling.rateLimitHeaders?.reset ?? 'ratelimit-reset';

      this.logger.warn(
        {
          endpoint: response.url,
          rateLimitLimit,
          rateLimitRemaining,
          timeToSleepInMs,
        },
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
