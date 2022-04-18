import fetch, { RequestInfo, RequestInit } from 'node-fetch';
import { URLSearchParams } from 'url';

import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

import {
  RateLimitConfig,
  APIRequest,
  APIResponse,
  PaginationParams,
  QueryParams,
  ResourcesResponse,
  PaginationMeta,
  RateLimitState,
} from './types';

function getUnixTimeNow() {
  return Date.now() / 1000;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  reserveLimit: 30,
  cooldownPeriod: 1000,
};

export type APIResourceIterationCallback<T> = (
  resources: T[],
) => boolean | void | Promise<boolean | void>;

export class APIClient {
  private logger: IntegrationLogger;
  private rateLimitConfig: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG;

  constructor(logger: IntegrationLogger) {
    this.logger = logger;
  }

  async paginateResources<ResourceType>({
    callback,
    apiUrl,
    query,
  }: {
    callback: APIResourceIterationCallback<ResourceType>;
    apiUrl: string;
    query?: QueryParams;
  }): Promise<void> {
    let seen: number = 0;
    let total: number = 0;
    let finished = false;

    let paginationParams: PaginationParams | undefined = undefined;

    do {
      const url = `${apiUrl}?${toQueryString(
        paginationParams,
        query,
      )}`;

      this.logger.info({ requestUrl: url, paginationParams });
      const response: ResourcesResponse<ResourceType> =
        await this.executeAuthenticatedAPIRequest<
          ResourcesResponse<ResourceType>
        >(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
        });

      await callback(response.resources);

      this.logger.info(
        {
          pagination: response.meta,
          resourcesLength: response.resources.length,
        },
        'pagination response details',
      );

      paginationParams = response.meta.pagination as PaginationMeta;
      seen += response.resources.length;
      total = paginationParams.total!;
      finished = seen === 0 || seen >= total;

      this.logger.info(
        { seen, total, finished },
        'post-request pagination state',
      );
    } while (!finished);
  }

  async executeAuthenticatedAPIRequest<ResponseType>(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<ResponseType> {
    return this.executeAPIRequest<ResponseType>(info, {
      ...init,
      headers: { ...init.headers },
    });
  }

  private async executeAPIRequest<ResponseType>(
    info: RequestInfo,
    init: RequestInit,
  ): Promise<ResponseType> {
    const apiResponse = await this.executeAPIRequestWithRateLimitRetries({
      url: info as string,
      exec: () => fetch(info, init),
    });

    if (apiResponse.status >= 400) {
      const err = new Error(
        `API request error for ${info}: ${apiResponse.statusText}`,
      );
      Object.assign(err, { code: apiResponse.status });
      throw err;
    }

    return apiResponse.response.json();
  }

  //TODO abstract out which Header values we're grabbing for limit and remaining values.
  private async executeAPIRequestWithRateLimitRetries<T>(
    request: APIRequest,
  ): Promise<APIResponse> {
    let attempts = 0;
    let rateLimitState: RateLimitState;

    do {
      const response = await request.exec();

      rateLimitState = {
        limitRemaining: Number(response.headers.get('X-RateLimit-Remaining')),
        perMinuteLimit: Number(response.headers.get('X-RateLimit-Limit')),
        retryAfter:
          response.headers.get('X-RateLimit-RetryAfter') &&
          Number(response.headers.get('X-RateLimit-RetryAfter')),
      };

      if (response.status !== 429 && response.status !== 500) {
        return {
          response,
          status: response.status,
          statusText: response.statusText,
        };
      }

      if (response.status === 429) {
        const unixTimeNow = getUnixTimeNow();
        /**
         * We have seen in the wild that waiting until the
         * `x-ratelimit-retryafter` unix timestamp before retrying requests
         * does often still result in additional 429 errors. This may be caused
         * by incorrect logic on the API server, out-of-sync clocks between
         * client and server, or something else. However, we have seen that
         * waiting an additional minute does result in successful invocations.
         *
         * `timeToSleepInSeconds` adds 60s to the `retryAfter` property, but
         * may be reduced in the future.
         */
        const timeToSleepInSeconds = rateLimitState.retryAfter
          ? rateLimitState.retryAfter + 60 - unixTimeNow
          : 0;
        this.logger.info(
          {
            unixTimeNow,
            timeToSleepInSeconds,
            rateLimitState,
            rateLimitConfig: this.rateLimitConfig,
          },
          'Encountered 429 response. Waiting to retry request.',
        );
        await sleep(timeToSleepInSeconds * 1000);
        if (
          rateLimitState.limitRemaining &&
          rateLimitState.limitRemaining <= this.rateLimitConfig.reserveLimit
        ) {
          this.logger.info(
            {
              rateLimitState,
              rateLimitConfig: this.rateLimitConfig,
            },
            'Rate limit remaining is less than reserve limit. Waiting for cooldown period.',
          );
          await sleep(this.rateLimitConfig.cooldownPeriod);
        }
      }

      attempts += 1;
      this.logger.warn(
        {
          rateLimitState,
          attempts,
          url: request.url,
          status: response.status,
        },
        'Encountered retryable status code from Crowdstrike API',
      );
    } while (attempts < this.rateLimitConfig.maxAttempts);

    throw new Error(`Could not complete request within ${attempts} attempts!`);
  }
}

function toQueryString(
  pagination?: {
    limit?: number;
    offset?: number | string;
    after?: number | string;
  },
  queryParams?: object,
): URLSearchParams {
  const params = new URLSearchParams();

  if (pagination) {
    if (typeof pagination.limit === 'number') {
      params.append('limit', String(pagination.limit));
    }
    if (pagination.offset !== undefined) {
      params.append('offset', String(pagination.offset));
    }
    if (pagination.after !== undefined) {
      params.append('after', String(pagination.after));
    }
  }

  if (queryParams) {
    for (const e of Object.entries(queryParams)) {
      params.append(e[0], String(e[1]));
    }
  }

  return params;
}
