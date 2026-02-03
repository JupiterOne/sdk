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

export interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
  compressUploads?: boolean;
}

/**
 * Internal-only type for detecting removed options and throwing clear errors.
 * Not exported — callers should not see these fields in the public API.
 */
interface UnsupportedCreateApiClientInput {
  alphaOptions?: unknown;
  proxyUrl?: unknown;
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
}: CreateApiClientInput & UnsupportedCreateApiClientInput): ApiClient {
  if (alphaOptions !== undefined) {
    throw new Error(
      'alphaOptions is no longer supported. Use retryOptions instead.',
    );
  }
  if (proxyUrl !== undefined) {
    throw new Error(
      'proxyUrl is no longer supported. Use environment-level proxy configuration (e.g., HTTPS_PROXY) instead.',
    );
  }

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
  // Default to true to match previous Alpha behavior where uploads were always compressed
  const apiClient = client as ApiClient;
  if (compressUploads !== false) {
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
