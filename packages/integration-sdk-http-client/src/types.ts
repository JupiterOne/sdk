import { IntegrationLogger } from '@jupiterone/integration-sdk-core';
import { AttemptContext } from '@lifeomic/attempt';

export type OptionalPromise<T> = T | Promise<T>;

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  bodyType?: 'json' | 'form';
  headers?: Record<string, string>;
  authorize?: boolean;
  bucketTokens?: number;
}

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  factor: number;
  timeout: number;
  timeoutMaxAttempts: number;
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
  resetMode?: 'remaining_epoch_s' | 'datetime_epoch_s';
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

export interface NextPageData {
  body: Record<string, any>;
  headers: Record<string, string[]>;
}
