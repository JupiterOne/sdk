import { APIError } from './errors';

export type APIRequest = {
  url: string;
  method: string;
  headers: Object;
};

export type APIRequestOptions = {
  retryConfig?: RetryConfig;
};

export type ResolvedAPIRequestOptions = {
  retryConfig: {
    isRetryable: IsRetryableFunction;
    maxAttempts: number;
    currentAttempt: number;
    rateLimitConfig: Required<RateLimitConfig>;
  };
};

export type RetryConfig = {
  isRetryable?: IsRetryableFunction;
  maxAttempts?: number;
  currentAttempt?: number;
  rateLimitConfig?: RateLimitConfig;
};

/**
 * IsRetryableFunction determines if a request should be retried.
 * @returns true if the request should be retried, false otherwise.
 */
export type IsRetryableFunction = (err: APIError) => boolean;

export type APIResponse = {
  data: any;
  headers: any;
  status: number;
  statusText: string;
};

// TODO (adam-in-ict), we're not currently paginating anywhere yet.
type PaginationState = {
  /**
   * Fetch limit, will be URL encoded as value of `limit` GET parameter.
   */
  limit?: number;

  /**
   * Total number of objects reported in API response. The number is affected by
   * the filter, if any.
   */
  total?: number;

  /**
   * Fetch offset, a number to start from or a cursor, depending on API.
   */
  offset?: number | string;

  /**
   * Offset cursor expiration time, only present for cursor based API.
   */
  expiresAt?: number;

  /**
   * Similar to "offset", a value to start from aka a cursor.
   */
  after?: number | string;

  /**
   * Number of resources returned through pagination to the point of offset.
   */
  seen: number;

  /**
   * Number of pages returned through pagination to the point of offset.
   */
  pages: number;

  /**
   * Pagination has completed according to provided pagination parameters.
   */
  finished: boolean;
};

export type PaginationParams = Partial<PaginationState>;

export type QueryParams = {
  filter?: string;
  [name: string]: string | undefined;
};

export type RateLimitConfig = {
  /**
   * The limit remaining value at which the client should slow down. This
   * prevents the client from consuming all available requests.
   */
  reserveLimit: number;

  /**
   * A recommended period of time in milliseconds to wait between requests when
   * the `reserveLimit` is reached.
   *
   * This can be a value representing the refill rate of a "leaky bucket" or
   * just a guess about how soon another request can be made. Ideally there will
   * be enough information in the response headers to calculate a better value.
   */
  cooldownPeriod: number;

  /**
   * Optional number of additional seconds to sleep in the event of a rate limit
   * event.
   */
  sleepAdditionalSeconds: number;
  /**
   * The rate limit headers to be used.
   * @param rateLimitLimit Often corresponds to `X-RateLimit-Limit` header.
   * @param rateLimitRemaining Often corresponds to `X-RateLimit-Remaining` header.
   * @param rateLimitReset Often corresponds to `X-RateLimit-Reset` header.
   * @param retryAfter
   */
  rateLimitHeaders?: RateLimitHeaders;
};

export type RateLimitHeaders = {
  rateLimitLimit: string;
  rateLimitRemaining: string;
  rateLimitReset: string;
  retryAfter: string;
};

/**
 * The last seen values from rate limit response headers.
 */
export type RateLimitState = {
  /**
   * Maximum number of requests per minute that can be made by all API clients
   * in a customer account. Initial value assumes the published default of 100.
   */
  perMinuteLimit?: number;

  /**
   * Number of requests that remain in the account's rate limiting pool. The
   * total number available is not known.
   */
  limitRemaining?: number;

  /**
   * The next time when an account's rate limit pool will have at least one
   * request available.
   */
  retryAfter?: number;
};

/**
 * Metadata in API responses indicating the pagination state.
 */
export type PaginationMeta = {
  limit: number;
  total: number;
  offset: number | string;
  expires_at?: number;
};

type ResponseMeta = {
  trace_id: string;
  pagination?: PaginationMeta;
};

type ResponseError = {
  code: number;
  message: string;
};

export type ResourcesResponse<T> = {
  meta: ResponseMeta;
  errors: ResponseError[];
  resources: T[];
};

export type APIClientRateLimitConfig = {
  limitHeader: string;
  limitRemainingHeader: string;
  retryAfterHeader: string;
};

export type APIClientConfiguration = {
  rateLimitConfig: APIClientRateLimitConfig;
};
