import { Response } from 'node-fetch';

export type APIRequest = {
  url: string;
  exec: () => Promise<Response>;
};

export type APIResponse = {
  response: Response;
  status: Response['status'];
  statusText: Response['statusText'];
};

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
   * Maximum number of times to retry a request that continues to receive 429
   * responses.
   *
   * The client will respect `x-ratelimit-retryafter`, but should it end up in a
   * battle to get the next allowed request, it will give up after this many
   * tries.
   */
  maxAttempts: number;
};

/**
 * The last seen values from rate limit response headers.
 */
export type RateLimitState = {
  /**
   * Maximum number of requests per minute that can be made by all API clients
   * in a customer account. Initial value assumes the published default of 100.
   */
  perMinuteLimit: number;

  /**
   * Number of requests that remain in the account's rate limiting pool. The
   * total number available is not known.
   */
  limitRemaining: number;

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
