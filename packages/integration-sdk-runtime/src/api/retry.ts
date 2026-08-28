import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * Options controlling automatic retry of failed requests.
 *
 * These mirror the options previously accepted by `@lifeomic/alpha`, whose
 * retry behavior this module reimplements exactly. Existing callers that
 * passed `retryOptions` to `createApiClient` do not need to change.
 */
export interface RetryOptions {
  /**
   * Maximum number of *retries* (not total attempts) to perform. Defaults to
   * 3, meaning a request may be issued up to 4 times.
   */
  attempts?: number;
  /** Base of the exponential backoff. Defaults to 2. */
  factor?: number;
  /** Upper bound, in milliseconds, on any single backoff delay. Defaults to 10000. */
  maxTimeout?: number;
  /**
   * Predicate deciding whether a given error is retryable. Defaults to
   * {@link isRetryableError}.
   */
  retryCondition?: (err: Error) => boolean;
}

/** A request config carrying retry state. */
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  retry?: RetryOptions | boolean;
  __retryCount?: number;
}

/**
 * Retries connection-level failures and 5xx responses, but never a request
 * that was aborted (`ECONNABORTED` covers both explicit aborts and timeouts).
 *
 * A missing `response` means the request never completed a round trip
 * (DNS failure, connection reset, socket hang up), which is retryable.
 */
export const isRetryableError = (err: any): boolean =>
  err.code !== 'ECONNABORTED' &&
  (!err.response || (err.response.status >= 500 && err.response.status <= 599));

export const RETRY_DEFAULTS: Required<RetryOptions> = {
  attempts: 3,
  factor: 2,
  maxTimeout: 10000,
  retryCondition: isRetryableError,
};

/**
 * Assigns `source` values onto `target` only where `target` has no defined
 * value, matching lodash `defaults` semantics.
 */
function applyDefaults(
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> {
  for (const key of Object.keys(source)) {
    if (target[key] === undefined) {
      target[key] = source[key];
    }
  }
  return target;
}

function exponentialBackoff(config: RetryableRequestConfig): Promise<void> {
  const retry = config.retry as Required<RetryOptions>;
  config.__retryCount = (config.__retryCount ?? 0) + 1;

  // Random base delay between 0 and 1000ms.
  const random = Math.random() * 1000;
  // Jitter the backoff within the range of [70%...100%].
  const jitter = 1 - (Math.random() % 0.3);
  const backoff = Math.pow(retry.factor, config.__retryCount) * random * jitter;
  const delay = Math.min(backoff, retry.maxTimeout);

  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Installs a response interceptor that retries failed requests using
 * exponential backoff with jitter.
 *
 * Retry is opt-in per request: it only engages when the request config carries
 * a truthy `retry` property. `createApiClient` sets this on the instance
 * defaults so that every request through the client participates.
 *
 * IMPORTANT: this must be registered before any other response interceptor
 * that mutates the error's `config`, because the retry replays that exact
 * config. Registering header redaction first, for example, would cause the
 * replayed request to send a literal '[REDACTED]' in place of its headers.
 */
export function attachRetryInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use(undefined, async (err: any) => {
    if (!(err && 'config' in err && err.config && err.config.retry)) {
      return Promise.reject(err);
    }

    const config = err.config as RetryableRequestConfig;

    if (typeof config.retry === 'boolean') {
      config.retry = {};
    }
    config.retry = applyDefaults(
      config.retry as Record<string, any>,
      RETRY_DEFAULTS,
    ) as RetryOptions;
    config.__retryCount = config.__retryCount || 0;

    const retry = config.retry as Required<RetryOptions>;

    if (
      !retry.retryCondition(err as Error) ||
      config.__retryCount >= retry.attempts
    ) {
      return Promise.reject(err);
    }

    await exponentialBackoff(config);

    return client.request(config);
  });
}
