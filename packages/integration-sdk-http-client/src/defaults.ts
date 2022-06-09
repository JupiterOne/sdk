import { APIError } from './errors';
import {
  IsRetryableFunction,
  RateLimitConfig,
  RateLimitHeaders,
  ResolvedAPIRequestOptions,
} from './types';
import { isRetryableStatusCode } from './util';

export const defaultIsRetryable: IsRetryableFunction = (err: APIError) => {
  if (isRetryableStatusCode(err.status)) {
    return true;
  } else {
    return false;
  }
};

export const DEFAULT_RATE_LIMIT_HEADERS: Required<RateLimitHeaders> = {
  rateLimitRemaining: 'X-RateLimit-Remaining',
  rateLimitLimit: 'X-RateLimit-Limit',
  rateLimitReset: 'X-RateLimit-Reset',
  retryAfter: 'Retry-After',
};

export const DEFAULT_RATE_LIMIT_CONFIG: Required<RateLimitConfig> = {
  reserveLimit: 30,
  cooldownPeriod: 1000,
  sleepAdditionalSeconds: 0,
  rateLimitHeaders: DEFAULT_RATE_LIMIT_HEADERS,
};

export const DEFAULT_REQUEST_OPTIONS: ResolvedAPIRequestOptions = {
  retryConfig: {
    isRetryable: defaultIsRetryable,
    maxAttempts: 5,
    currentAttempt: 0,
    rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
  },
};
