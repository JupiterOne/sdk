import fetch, { Headers, Response } from 'node-fetch';
import {
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
} from './types';

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
    limit: 'x-rate-limit-limit',
    remaining: 'x-rate-limit-remaining',
    reset: 'x-rate-limit-reset',
  };

export abstract class APIClient {
  protected baseUrl: string;
  protected logger: IntegrationLogger;
  protected retryOptions: RetryOptions;
  protected logErrorBody: boolean;
  protected rateLimitThrottling: RateLimitThrottlingOptions | undefined;

  /**
   * The authentication headers for the API requests
   */
  protected authenticationHeaders: Record<string, string>;

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
   * @param {RateLimitHeaders} [config.rateLimitThrottling.rateLimitHeaders] - The headers to use for rate limiting
   * @param {string} [config.rateLimitThrottling.rateLimitHeaders.limit='x-rate-limit-limit'] - The header for the rate limit limit
   * @param {string} [config.rateLimitThrottling.rateLimitHeaders.remaining='x-rate-limit-remaining'] - The header for the rate limit remaining
   * @param {string} [config.rateLimitThrottling.rateLimitHeaders.reset='x-rate-limit-reset'] - The header for the rate limit reset
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
  }

  protected withBaseUrl(endpoint: string): string {
    return new URL(endpoint, this.baseUrl).toString();
  }

  /**
   * Get the authentication headers for the API requests.
   *
   * @return {Promise<Record<string, string>>} - The authentication headers
   *
   * @example
   * ```typescript
   * async getAuthenticationHeaders(): Record<string, string> {
   *   return {
   *     Authorization: `Bearer ${this.config.apiKey}`,
   *   };
   * }
   * ```
   * @example
   * ```typescript
   * async getAuthenticationHeaders(): Promise<Record<string, string>> {
   *   const response = this.request('/token', {
   *     method: 'POST',
   *     body: {
   *       email: this.config.email,
   *       password: this.config.password,
   *     },
   *     authenticate: false, // don't try to authenticate this request, it will go into an infinite loop.
   *   });
   *   const data = await response.json();
   *   return {
   *     Authorization: `Bearer ${data.token}`,
   *   };
   * }
   */
  abstract getAuthenticationHeaders(): OptionalPromise<Record<string, string>>;

  /**
   * Perform a request to the API.
   *
   * @param {string} endpoint - The endpoint to request
   * @param {RequestOptions} options - The options for the request
   * @param {string} [options.method=GET] - The HTTP method to use
   * @param {Record<string, unknown>} [options.body] - The body of the request
   * @param {Record<string, string>} [options.headers] - The headers for the request
   * @param {boolean} [options.authenticate=true] - Whether to include authentication headers
   * @return {Promise<Response>} - The response from the API
   */
  protected async request(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<Response> {
    const {
      method = 'GET',
      body,
      headers,
      authenticate = true,
    } = options ?? {};
    if (authenticate && !this.authenticationHeaders) {
      this.authenticationHeaders = await this.getAuthenticationHeaders();
    }
    const response = await fetch(this.withBaseUrl(endpoint), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authenticate && this.authenticationHeaders),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return response;
  }

  /**
   * Perform a request to the API with retries and error handling.
   *
   * @param {string} endpoint - The endpoint to request
   * @param {RequestOptions} options - The options for the request
   * @param {string} [options.method=GET] - The HTTP method to use
   * @param {Record<string, unknown>} [options.body] - The body of the request
   * @param {Record<string, string>} [options.headers] - The headers for the request
   * @param {boolean} [options.authenticate=true] - Whether to include authentication headers
   * @return {Promise<Response>} - The response from the API
   */
  protected async retryRequest(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<Response> {
    const {
      method = 'GET',
      body,
      headers,
      authenticate = true,
    } = options ?? {};
    return retry(
      async () => {
        return this.withRateLimiting(async () => {
          let response: Response | undefined;
          try {
            response = await this.request(endpoint, {
              method,
              body,
              headers,
              authenticate,
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
          if (isRetryableRequest(response)) {
            error = await retryableRequestError(requestErrorParams);
          } else {
            error = await fatalRequestError(requestErrorParams);
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
    const nowDate = new Date(headers.get('date') ?? Date.now());
    const retryDate = new Date(parseInt(resetValue, 10) * 1000);
    return retryDate.getTime() - nowDate.getTime() + 1000;
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
