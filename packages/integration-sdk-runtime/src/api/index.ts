import { AxiosInstance } from 'axios';
import { Alpha, AlphaInterceptor, AlphaOptions } from '@lifeomic/alpha';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';
import { gzipData } from '../synchronization/util';

export type ApiClient = AxiosInstance;

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
  compressUploads?: boolean;
  alphaOptions?: AlphaOptions;
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
}: CreateApiClientInput): ApiClient {
  const headers: Record<string, string> = {
    'LifeOmic-Account': account,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const opts: AlphaOptions = {
    baseURL: apiBaseUrl,
    headers,
    retry: retryOptions ?? {},
    ...alphaOptions,
  };

  const client = new Alpha(opts) as ApiClient;
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
