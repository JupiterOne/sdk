import { DEFAULT_RATE_LIMIT_HEADERS } from './defaults';
import {
  APIRequestOptions,
  RateLimitConfig,
  RateLimitHeaders,
  ResolvedAPIRequestOptions,
} from './types';

export function getUnixTimeNow() {
  return Date.now() / 1000;
}

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function retiresAvailable(
  currentAttempt: number,
  maxAttempts: number,
): boolean {
  return currentAttempt < maxAttempts;
}

/**
 * Returns true when we have a status code that is an error but not retryable.
 * @param statusCode
 * @returns boolean
 */
export function isNonRetryableError(statusCode: number): boolean {
  // TODO (adam-in-ict) make range of retryable error codes configurable
  if (statusCode !== 429 && statusCode >= 400) {
    return true;
  }
  return false;
}

export function isRetryableStatusCode(statusCode: number): boolean {
  if (
    statusCode === 429 ||
    statusCode === 408 ||
    (statusCode >= 500 && statusCode !== 501)
  ) {
    return true;
  }
  return false;
}

function createRateLimitErrorHandler(rateLimitConfig: RateLimitConfig) {
  // TODO: just require theat rateLimitConfig is all defined
  const resolvedRateLimitHeaders = resolveRateLimitHeaders(
    rateLimitConfig.rateLimitHeaders,
  );

  return async (headers: Headers) => {
    // Hard to distinguish from types success case and undefined case
    // rateLimitRemaining could be zero based on undefined header or actually zero
    // from the response :/
    const rateLimitState = {
      rateLimitRemaining: getNumbericHeader(
        headers,
        resolvedRateLimitHeaders.rateLimitRemaining,
      ),
      rateLimitLimit: getNumbericHeader(
        headers,
        resolvedRateLimitHeaders.rateLimitLimit,
      ),
      retryAfter: getNumbericHeader(
        headers,
        resolvedRateLimitHeaders.retryAfter,
      ),
    };

    const unixTimeNow = getUnixTimeNow();

    // calculate the time to sleep based on header values and additional rateLimitConfig values
    // TODO:
    // seperate the sleep due to retryAfter from the sleep due to rateLimitRemaining
    const timeToSleepInSeconds = rateLimitState.retryAfter
      ? Math.max(
          rateLimitState.retryAfter +
            rateLimitConfig.sleepAdditionalSeconds -
            unixTimeNow,
          0,
        )
      : 0;

    await sleep(timeToSleepInSeconds * 1000);
    if (
      rateLimitState.rateLimitRemaining &&
      rateLimitState.rateLimitRemaining <= rateLimitConfig.reserveLimit
    ) {
      await sleep(rateLimitConfig.cooldownPeriod);
    }
  };
}

// TODO (adam-in-ict) abstract out which headers we want to use
export async function handleRateLimitError(headers, rateLimitConfig) {
  const rateLimitState = {
    limitRemaining: Number(headers.get('X-RateLimit-Remaining')),
    perMinuteLimit: Number(headers.get('X-RateLimit-Limit')),
    retryAfter:
      headers.get('X-RateLimit-RetryAfter') &&
      Number(headers.get('X-RateLimit-RetryAfter')),
  };

  const unixTimeNow = getUnixTimeNow();

  // calculate the time to sleep based on header values and additional rateLimitConfig values
  const timeToSleepInSeconds = rateLimitState.retryAfter
    ? Math.max(
        rateLimitState.retryAfter +
          rateLimitConfig.sleepAdditionalSeconds -
          unixTimeNow,
        0,
      )
    : 0;

  await sleep(timeToSleepInSeconds * 1000);
  if (
    rateLimitState.limitRemaining &&
    rateLimitState.limitRemaining <= rateLimitConfig.reserveLimit
  ) {
    await sleep(rateLimitConfig.cooldownPeriod);
  }
}
export function resolveOptions(
  options: APIRequestOptions,
  defaultOptions: ResolvedAPIRequestOptions,
): ResolvedAPIRequestOptions {
  return {
    retryConfig: {
      currentAttempt:
        options?.retryConfig?.currentAttempt ??
        defaultOptions.retryConfig.currentAttempt,
      maxAttempts:
        options?.retryConfig?.maxAttempts ??
        defaultOptions.retryConfig.maxAttempts,
      isRetryable:
        options?.retryConfig?.isRetryable ??
        defaultOptions.retryConfig.isRetryable,
      rateLimitConfig: {
        reserveLimit:
          options?.retryConfig?.rateLimitConfig?.reserveLimit ??
          defaultOptions.retryConfig.rateLimitConfig.reserveLimit,
        cooldownPeriod:
          options?.retryConfig?.rateLimitConfig?.cooldownPeriod ??
          defaultOptions.retryConfig.rateLimitConfig.cooldownPeriod,
        sleepAdditionalSeconds:
          options?.retryConfig?.rateLimitConfig?.sleepAdditionalSeconds ??
          defaultOptions.retryConfig.rateLimitConfig.sleepAdditionalSeconds,
        rateLimitHeaders:
          options?.retryConfig?.rateLimitConfig?.rateLimitHeaders ??
          defaultOptions.retryConfig.rateLimitConfig.rateLimitHeaders,
      },
    },
  };
}

// TODO: this function should be removed and just pass around pre-resolved objects
function resolveRateLimitHeaders(
  rateLimitHeaders: RateLimitHeaders | undefined,
): Required<RateLimitHeaders> {
  return {
    rateLimitLimit:
      rateLimitHeaders?.rateLimitLimit ??
      DEFAULT_RATE_LIMIT_HEADERS.rateLimitLimit,
    rateLimitRemaining:
      rateLimitHeaders?.rateLimitRemaining ??
      DEFAULT_RATE_LIMIT_HEADERS.rateLimitRemaining,
    rateLimitReset:
      rateLimitHeaders?.rateLimitReset ??
      DEFAULT_RATE_LIMIT_HEADERS.rateLimitReset,
    retryAfter:
      rateLimitHeaders?.retryAfter ?? DEFAULT_RATE_LIMIT_HEADERS.retryAfter,
  };
}

function getNumbericHeader(
  headers: Headers,
  headerName: string,
): number | undefined {
  const headerValue = headers.get(headerName);
  if (headerValue === null || headerValue === '') {
    return undefined;
  }

  const numericHeaderValue = Number(headerValue);

  if (
    // TODO:
    // is this the right function to call
    Number.isSafeInteger(numericHeaderValue)
  ) {
    return numericHeaderValue;
  } else {
    return undefined;
  }
}
