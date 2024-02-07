import fetch, { type Response } from 'node-fetch';
import {
  type IntegrationLogger,
  IntegrationProviderAPIError,
} from '@jupiterone/integration-sdk-core';
import { type AttemptContext, retry, sleep } from '@lifeomic/attempt';
import {
  fatalRequestError,
  isRetryableRequest,
  retryableRequestError,
} from './errors';
import type {
  ClientConfig,
  OptionalPromise,
  RetryOptions,
  RequestOptions,
} from './types';

const defaultErrorHandler = async (
  err: any,
  context: AttemptContext,
  logger?: IntegrationLogger
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
    const retryAfter = err.retryAfter ? err.retryAfter * 1000 : 5000;
    logger?.warn(
      { retryAfter },
      `Received a rate limit error. Waiting before retrying.`
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

export abstract class APIClient {
  protected authenticationHeaders: Record<string, string>;
  protected logger?: IntegrationLogger;
  protected retryOptions: RetryOptions;
  protected logErrorBody: boolean;
  protected baseUrl: string;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.logger = config.logger;
    this.retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      ...config.retryOptions,
    };
    this.logErrorBody = config.logErrorBody ?? false;
  }

  protected withBaseUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
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
   * Perform a request to the API
   * @param {string} endpoint - The endpoint to request
   * @param {RequestOptions} options - The options for the request
   * @param {string} [options.method=GET] - The HTTP method to use
   * @param {Record<string, unknown>} [options.body] - The body of the request
   * @param {boolean} [options.authenticate=true] - Whether to include authentication headers
   * @return {Promise<Response>} - The response from the API
   */
  protected async request(
    endpoint: string,
    { method = 'GET', body, headers, authenticate = true }: RequestOptions
  ): Promise<Response> {
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

  protected async retryRequest(
    endpoint: string,
    { method = 'GET', body, authenticate = true }: RequestOptions
  ): Promise<Response> {
    return retry(
      async () => {
        let response: Response | undefined;
        try {
          response = await this.request(endpoint, {
            method,
            body,
            authenticate,
          });
        } catch (err) {
          this.logger?.error(
            { code: err.code, err, endpoint },
            'Error sending request'
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
      },
      {
        maxAttempts: this.retryOptions.maxAttempts,
        delay: this.retryOptions.delay,
        timeout: this.retryOptions.timeout,
        factor: this.retryOptions.factor,
        handleError: async (err, context) => {
          await this.retryOptions.handleError(err, context, this.logger);
        },
      }
    );
  }
}
