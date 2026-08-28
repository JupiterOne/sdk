import axios, {
  AxiosInstance,
  AxiosProxyConfig,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';
import { gzipData } from '../synchronization/util';
import { attachRetryInterceptor, RetryOptions } from './retry';

export type { RetryOptions } from './retry';
export { isRetryableError } from './retry';

export type ApiClient = AxiosInstance;

/**
 * Request configuration accepted by {@link createApiClient}, including the
 * `retry` options honored by the client's retry interceptor.
 */
export type ApiClientRequestConfig = AxiosRequestConfig & {
  retry?: RetryOptions | boolean;
};

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
  compressUploads?: boolean;
  /**
   * Additional request configuration merged into the client's defaults.
   *
   * @deprecated The client is now a plain axios instance; prefer
   * `axiosOptions`. This alias is retained for backwards compatibility and
   * will be removed in a future major version.
   */
  alphaOptions?: ApiClientRequestConfig;
  /** Additional request configuration merged into the client's defaults. */
  axiosOptions?: ApiClientRequestConfig;
  proxyUrl?: string;
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
  retryOptions,
  compressUploads,
  alphaOptions,
  axiosOptions,
  proxyUrl,
}: CreateApiClientInput): ApiClient {
  const headers: Record<string, string> = {
    'JupiterOne-Account': account,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const proxyUrlString = proxyUrl || getProxyFromEnvironment();
  const proxy = proxyUrlString ? parseProxyUrl(proxyUrlString) : undefined;

  const opts: ApiClientRequestConfig = {
    baseURL: apiBaseUrl,
    headers,
    retry: retryOptions ?? {},
    ...(proxy && { proxy }),
    ...alphaOptions,
    ...axiosOptions,
  };

  const client = axios.create(opts);

  // Retry must be registered before the redaction interceptor below: it
  // replays `error.config`, which redaction overwrites.
  attachRetryInterceptor(client);

  // Redact Authorization header from error response
  client.interceptors?.response?.use(
    (response) => response,
    (error: any) => {
      if (error?.config?.headers) {
        error.config.headers = '[REDACTED]';
      }

      if (error?.response?.config?.headers) {
        error.response.config.headers = '[REDACTED]';
      }

      if (typeof error?.request?._header === 'string') {
        error.request._header = error.request._header.replace(
          /Authorization: Bearer\s[^\r\n]+/i,
          'Authorization: [REDACTED]',
        );
      }

      const outHeadersSym = Object.getOwnPropertySymbols(
        error.request || {},
      ).find((sym) => String(sym).includes('kOutHeaders'));
      if (outHeadersSym) {
        const outHeaders = (error.request as any)[outHeadersSym];
        if (outHeaders?.authorization) {
          outHeaders.authorization = '[REDACTED]';
        }
      }

      return Promise.reject(error);
    },
  );

  if (compressUploads) {
    // Request interceptors must return the config (or a promise for it).
    client.interceptors.request.use(compressRequest);
  }
  return client;
}

export const compressRequest = async function (
  config: InternalAxiosRequestConfig,
): Promise<InternalAxiosRequestConfig> {
  if (
    config.method === 'post' &&
    config.url &&
    /\/persister\/synchronization\/jobs\/[0-9a-fA-F-]+\/(entities|relationships)/.test(
      config.url,
    )
  ) {
    // axios >=1 hands request interceptors an AxiosHeaders instance, which
    // exposes `set`. Fall back to plain assignment so hand-built config
    // objects (as used in tests) keep working.
    const headers = config.headers as any;
    if (typeof headers?.set === 'function') {
      headers.set('Content-Encoding', 'gzip');
    } else if (headers) {
      headers['Content-Encoding'] = 'gzip';
    } else {
      config.headers = { 'Content-Encoding': 'gzip' } as any;
    }
    config.data = await gzipData(config.data);
  }
  return config;
};

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

function parseProxyUrl(proxyUrl: string) {
  const url = new URL(proxyUrl);
  const proxy: AxiosProxyConfig = {
    host: url.hostname,
    port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
    protocol: url.protocol.replace(':', ''),
  };

  if (url.username && url.password) {
    proxy.auth = {
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
    };
  }

  return proxy;
}

function getProxyFromEnvironment(): string | undefined {
  dotenvExpand(dotenv.config());
  return process.env.HTTPS_PROXY || process.env.https_proxy;
}
