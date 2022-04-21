import fetch from 'node-fetch';

import {
  RateLimitConfig,
  APIResponse,
  RateLimitState,
  APIRequest,
} from './types';

function getUnixTimeNow() {
  return Date.now() / 1000;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  //TODO abstract out which Header values we're grabbing for rate limiting.
  async executeAPIRequest(request: APIRequest): Promise<APIResponse> {
    let attempts = 0;
    let rateLimitState: RateLimitState;

    do {
      const response = await fetch(request.url, request);

      if (response.status !== 429) {
        if (response.status >= 400) {
          const err = new Error(
            `API request error for ${request.url}: ${response.statusText}`,
          );
          Object.assign(err, { code: response.status });
          throw err;
        }
        return {
          data: await response.json(),
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        };
      } else {
        rateLimitState = {
          limitRemaining: Number(response.headers.get('X-RateLimit-Remaining')),
          perMinuteLimit: Number(response.headers.get('X-RateLimit-Limit')),
          retryAfter:
            response.headers.get('X-RateLimit-RetryAfter') &&
            Number(response.headers.get('X-RateLimit-RetryAfter')),
        };

        const unixTimeNow = getUnixTimeNow();
        const timeToSleepInSeconds = rateLimitState.retryAfter
          ? rateLimitState.retryAfter +
            this.rateLimitConfig.sleepAdditionalSeconds -
            unixTimeNow
          : 0;
        await sleep(timeToSleepInSeconds * 1000);
        if (
          rateLimitState.limitRemaining &&
          rateLimitState.limitRemaining <= this.rateLimitConfig.reserveLimit
        ) {
          await sleep(this.rateLimitConfig.cooldownPeriod);
        }
      }
      attempts += 1;
    } while (attempts < this.rateLimitConfig.maxAttempts);

    throw new Error(`Could not complete request within ${attempts} attempts!`);
  }
}
