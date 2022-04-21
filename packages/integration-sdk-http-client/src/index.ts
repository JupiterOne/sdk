import fetch from 'node-fetch';
import { getUnixTimeNow, sleep, isNonRetryableError } from './util';
import {
  RateLimitConfig,
  APIResponse,
  RateLimitState,
  APIRequest,
} from './types';

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  reserveLimit: 30,
  cooldownPeriod: 1000,
  sleepAdditionalSeconds: 0,
};

export type APIResourceIterationCallback<T> = (
  resources: T[],
) => boolean | void | Promise<boolean | void>;

export class APIClient {
  private rateLimitConfig: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG;
  private rateLimitState: RateLimitState;

  async executeAPIRequest(request: APIRequest): Promise<APIResponse> {
    let attempts = 0;

    do {
      const response = await fetch(request.url, request);

      if (isNonRetryableError(response.status)) {
        const err = new Error(
          `API request error for ${request.url}: ${response.statusText}`,
        );
        Object.assign(err, { code: response.status });
        throw err;
      }

      if (response.status === 429) {
        await this.handleRateLimitError(response.headers);
      } else {
        // Successful response, so return
        return {
          data: await response.json(),
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        };
      }

      attempts += 1;
    } while (attempts < this.rateLimitConfig.maxAttempts);

    throw new Error(`Could not complete request within ${attempts} attempts!`);
  }

  //TODO abstract out which Header values we're grabbing for rate limiting.
  /**
   * Get rate limit info, sleep, and then loop to retry
   *
   * @param headers
   */
  private async handleRateLimitError(headers) {
    this.rateLimitState = {
      limitRemaining: Number(headers.get('X-RateLimit-Remaining')),
      perMinuteLimit: Number(headers.get('X-RateLimit-Limit')),
      retryAfter:
        headers.get('X-RateLimit-RetryAfter') &&
        Number(headers.get('X-RateLimit-RetryAfter')),
    };

    const unixTimeNow = getUnixTimeNow();
    const timeToSleepInSeconds = this.rateLimitState.retryAfter
      ? this.rateLimitState.retryAfter +
        this.rateLimitConfig.sleepAdditionalSeconds -
        unixTimeNow
      : 0;
    await sleep(timeToSleepInSeconds * 1000);
    if (
      this.rateLimitState.limitRemaining &&
      this.rateLimitState.limitRemaining <= this.rateLimitConfig.reserveLimit
    ) {
      await sleep(this.rateLimitConfig.cooldownPeriod);
    }
  }
}
