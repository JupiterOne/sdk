import { Dispatcher, ProxyAgent, request } from 'undici';
import { retry } from '@lifeomic/attempt';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';
import { gzipData } from '../synchronization/util';

export interface ApiClientResponse<T = any> {
  data: T;
  status?: number;
  statusText?: string;
}

export interface ApiRequestConfig {
  headers?: Record<string, string>;
  /** Disable the client's built-in retry (for callers with their own retry). */
  retry?: false;
}

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Exponential backoff factor (default 2). */
  factor?: number;
  /** Max backoff delay in ms (default 10000). */
  maxTimeout?: number;
  /** Decides whether a given error should be retried. */
  retryCondition?: (err: unknown) => boolean;
}

/**
 * Error thrown for non-2xx responses. Shape mirrors the fields consumers read
 * from the previous axios client (`response.status/statusText/data`, `config`),
 * but carries no live socket or request object, so it cannot leak credentials.
 */
export class ApiResponseError extends Error {
  readonly response: { status: number; statusText: string; data: any };
  readonly config: { url: string; method: string };

  constructor(
    method: string,
    url: string,
    status: number,
    statusText: string,
    data: any,
  ) {
    super(`Request failed with status code ${status}`);
    this.name = 'ApiResponseError';
    this.response = { status, statusText, data };
    this.config = { method, url };
  }
}

const PERSISTER_UPLOAD_PATH =
  /\/persister\/synchronization\/jobs\/[0-9a-fA-F-]+\/(entities|relationships)/;

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

function parseBody(text: string, contentType?: string): any {
  if (!text) return undefined;
  const isJson = contentType?.includes('application/json');
  if (isJson || text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/** Retry retryable statuses (429, 5xx) and transport errors (no response). */
function isRetryableError(err: unknown): boolean {
  if (err instanceof ApiResponseError) {
    const status = err.response.status;
    return status === 429 || status >= 500;
  }
  // Non-response errors are transport/network failures — retry them.
  return true;
}

/**
 * Minimal JupiterOne API client backed by undici. Exposes the `.get`/`.post`
 * surface the SDK and CLI rely on, with built-in retry on retryable errors
 * (callers with their own retry loop pass `config.retry = false`).
 */
export class ApiClient {
  private readonly baseURL: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly compressUploads: boolean;
  private readonly dispatcher?: Dispatcher;
  private readonly retryOptions: Required<Omit<RetryOptions, 'maxTimeout'>> & {
    maxTimeout: number;
  };

  constructor(opts: {
    baseURL: string;
    headers: Record<string, string>;
    compressUploads?: boolean;
    dispatcher?: Dispatcher;
    retryOptions?: RetryOptions;
  }) {
    this.baseURL = opts.baseURL;
    this.defaultHeaders = opts.headers;
    this.compressUploads = opts.compressUploads ?? false;
    this.dispatcher = opts.dispatcher;
    this.retryOptions = {
      attempts: opts.retryOptions?.attempts ?? 3,
      factor: opts.retryOptions?.factor ?? 2,
      maxTimeout: opts.retryOptions?.maxTimeout ?? 10_000,
      retryCondition: opts.retryOptions?.retryCondition ?? isRetryableError,
    };
  }

  get<T = any>(
    url: string,
    config?: ApiRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    return this.request<T>('GET', url, undefined, config);
  }

  post<T = any>(
    url: string,
    body?: unknown,
    config?: ApiRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    return this.request<T>('POST', url, body, config);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    url: string,
    bodyObj: unknown,
    config?: ApiRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    const fullUrl = new URL(url, this.baseURL).toString();
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...config?.headers,
    };

    let body: string | Buffer | undefined;
    if (bodyObj !== undefined) {
      // Gzip only the large persister entity/relationship uploads.
      if (
        this.compressUploads &&
        method === 'POST' &&
        PERSISTER_UPLOAD_PATH.test(url)
      ) {
        headers['Content-Encoding'] = 'gzip';
        body = await gzipData(bodyObj as object);
      } else {
        body = JSON.stringify(bodyObj);
      }
    }

    const send = async (): Promise<ApiClientResponse<T>> => {
      const res = await request(fullUrl, {
        method,
        headers,
        body,
        ...(this.dispatcher && { dispatcher: this.dispatcher }),
      });

      const text = await res.body.text();
      const contentType = res.headers['content-type'] as string | undefined;
      const data = parseBody(text, contentType);

      if (res.statusCode >= 400) {
        throw new ApiResponseError(
          method,
          fullUrl,
          res.statusCode,
          STATUS_TEXT[res.statusCode] ?? '',
          data,
        );
      }

      return {
        data: data as T,
        status: res.statusCode,
        statusText: STATUS_TEXT[res.statusCode] ?? '',
      };
    };

    // Callers with their own retry loop (uploadDataChunk, finalize) opt out to
    // avoid a nested double-retry.
    if (config?.retry === false) {
      return send();
    }

    const { attempts, factor, maxTimeout, retryCondition } = this.retryOptions;
    return retry(send, {
      maxAttempts: attempts,
      delay: 200,
      factor,
      maxDelay: maxTimeout,
      handleError: (err, context) => {
        if (!retryCondition(err)) context.abort();
      },
    });
  }
}

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  compressUploads?: boolean;
  proxyUrl?: string;
  retryOptions?: RetryOptions;
  /** Custom undici dispatcher (e.g. a test Agent or ProxyAgent override). */
  dispatcher?: Dispatcher;
}

/**
 * Configures an api client for hitting JupiterOne APIs.
 *
 * This function is rather generic and allows for
 * different apiBaseUrls to be provided.
 *
 * In managed environments, this can be configured to
 * hit public and private JupiterOne APIs.
 */
export function createApiClient({
  apiBaseUrl,
  account,
  accessToken,
  compressUploads,
  proxyUrl,
  retryOptions,
  dispatcher,
}: CreateApiClientInput): ApiClient {
  const headers: Record<string, string> = {
    'JupiterOne-Account': account,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const proxyUrlString = proxyUrl || getProxyFromEnvironment();
  const resolvedDispatcher =
    dispatcher ??
    (proxyUrlString ? createProxyAgent(proxyUrlString) : undefined);

  return new ApiClient({
    baseURL: apiBaseUrl,
    headers,
    compressUploads,
    dispatcher: resolvedDispatcher,
    retryOptions,
  });
}

interface GetApiBaseUrlInput {
  dev: boolean;
}

export const JUPITERONE_PROD_API_BASE_URL = 'https://api.us.jupiterone.io';
export const JUPITERONE_DEV_API_BASE_URL = 'https://api.dev.jupiterone.io';

export function getApiBaseUrl({ dev }: GetApiBaseUrlInput = { dev: false }) {
  if (dev) {
    return JUPITERONE_DEV_API_BASE_URL;
  } else {
    return JUPITERONE_PROD_API_BASE_URL;
  }
}

function getFromEnv(
  variableName: string,
  missingError: new () => IntegrationError,
): string {
  dotenvExpand(dotenv.config());

  const value = process.env[variableName];

  if (!value) {
    throw new missingError();
  }

  return value;
}

export const getApiKeyFromEnvironment = () =>
  getFromEnv('JUPITERONE_API_KEY', IntegrationApiKeyRequiredError);

export const getAccountFromEnvironment = () =>
  getFromEnv('JUPITERONE_ACCOUNT', IntegrationAccountRequiredError);

/** Builds an undici ProxyAgent from a proxy URL, including Basic auth. */
export function createProxyAgent(proxyUrl: string): ProxyAgent {
  const url = new URL(proxyUrl);
  const token =
    url.username && url.password
      ? `Basic ${Buffer.from(
          `${decodeURIComponent(url.username)}:${decodeURIComponent(
            url.password,
          )}`,
        ).toString('base64')}`
      : undefined;

  return new ProxyAgent({
    uri: `${url.protocol}//${url.host}`,
    ...(token && { token }),
  });
}

function getProxyFromEnvironment(): string | undefined {
  dotenvExpand(dotenv.config());
  return process.env.HTTPS_PROXY || process.env.https_proxy;
}
