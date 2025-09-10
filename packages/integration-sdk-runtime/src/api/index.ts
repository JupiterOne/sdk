import { Alpha, AlphaInterceptor, AlphaOptions } from '@lifeomic/alpha';
import { AxiosProxyConfig } from 'axios';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';
import { gzipData } from '../synchronization/util';

export type ApiClient = Alpha;

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
  compressUploads?: boolean;
  alphaOptions?: AlphaOptions;
  proxyUrl?: string;
}

interface RetryOptions {
  attempts?: number;
  factor?: number;
  maxTimeout?: number;
  retryCondition?: (err: Error) => boolean;
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

  const opts: AlphaOptions = {
    baseURL: apiBaseUrl,
    headers,
    retry: retryOptions ?? {},
    ...(proxy && { proxy }),
    ...alphaOptions,
  };

  const client = new Alpha(opts) as ApiClient;

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
    // interceptors is incorrectly typed even without the case to ApiClient.
    // an AxiosInterceptor doesn't work here. You must use the AlphaInterceptor
    // as we are registering these interceptors on the Alpha instance.
    // AlphaInterceptors _must_ return the config or a Promise for the config.
    client.interceptors.request.use(compressRequest);
  }
  return client;
}

export const compressRequest: AlphaInterceptor = async function (
  config: AlphaOptions,
) {
  if (
    config.method === 'post' &&
    config.url &&
    /\/persister\/synchronization\/jobs\/[0-9a-fA-F-]+\/(entities|relationships)/.test(
      config.url,
    )
  ) {
    if (config.headers) {
      config.headers['Content-Encoding'] = 'gzip';
    } else {
      config.headers = {
        'Content-Encoding': 'gzip',
      };
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
