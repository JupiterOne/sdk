import {
  createRequestClient,
  RequestClient,
  RequestClientConfig,
} from '@jupiterone/platform-sdk-fetch';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';

/**
 * Extended RequestClient with compression flag
 */
export interface ApiClient extends RequestClient {
  /**
   * Internal flag indicating whether uploads should be compressed.
   * @internal
   */
  _compressUploads?: boolean;
}

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
  compressUploads?: boolean;
  /**
   * @deprecated RequestClient does not support alphaOptions. Use retryOptions instead.
   */
  alphaOptions?: Partial<RequestClientConfig>;
  /**
   * @deprecated Proxy configuration is not supported by RequestClient.
   * Use environment-level proxy configuration instead.
   */
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
}: CreateApiClientInput): ApiClient {
  const headers: Record<string, string> = {
    'JupiterOne-Account': account,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const opts: RequestClientConfig = {
    baseURL: apiBaseUrl,
    headers,
    retry: retryOptions ?? {},
  };

  const client = createRequestClient(opts);

  // Redact Authorization header from error response
  client.interceptors.response.use(
    (response) => response,
    async (error: any) => {
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

  // Store compression flag on client for use by upload functions
  const apiClient = client as ApiClient;
  if (compressUploads) {
    apiClient._compressUploads = true;
  }

  return apiClient;
}

/**
 * Helper to check if an API client has upload compression enabled
 */
export function isUploadCompressionEnabled(client: ApiClient): boolean {
  return client._compressUploads === true;
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
