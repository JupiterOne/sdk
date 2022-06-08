import { APIRequestOptions, ResolvedAPIRequestOptions } from './types';

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
      },
    },
  };
}
