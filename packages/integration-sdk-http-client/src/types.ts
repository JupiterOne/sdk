import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { AttemptContext } from '@lifeomic/attempt';

export type OptionalPromise<T> = T | Promise<T>;

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  authorize?: boolean;
  bucketTokens?: number;
}

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  factor: number;
  timeout: number;
  handleError: (
    err: any,
    context: AttemptContext,
    logger: IntegrationLogger,
  ) => OptionalPromise<void>;
}

export interface RateLimitHeaders {
  limit: string;
  remaining: string;
  reset: string;
}

export interface RateLimitThrottlingOptions {
  threshold: number;
  rateLimitHeaders?: RateLimitHeaders;
}

export interface TokenBucketOptions {
  maximumCapacity: number;
  refillRate: number;
}

export interface ClientConfig {
  baseUrl: string;
  logger: IntegrationLogger;
  retryOptions?: Partial<RetryOptions>;
  logErrorBody?: boolean;
  rateLimitThrottling?: RateLimitThrottlingOptions;
  tokenBucket?: TokenBucketOptions;
}

export interface IterateCallbackResult {
  nextUrl?: string;
  nextRequestOptions?: RequestOptions;
}
