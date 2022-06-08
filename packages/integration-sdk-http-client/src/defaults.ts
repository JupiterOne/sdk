import { APIError } from './errors';
import {
  IsRetryableFunction,
  RateLimitConfig,
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

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  reserveLimit: 30,
  cooldownPeriod: 1000,
  sleepAdditionalSeconds: 0,
};

export const DEFAULT_REQUEST_OPTIONS: ResolvedAPIRequestOptions = {
  retryConfig: {
    isRetryable: defaultIsRetryable,
    maxAttempts: 5,
    currentAttempt: 0,
    rateLimitConfig: DEFAULT_RATE_LIMIT_CONFIG,
  },
};
