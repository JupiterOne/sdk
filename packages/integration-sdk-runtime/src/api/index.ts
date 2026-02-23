import {
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationAccountRequiredError,
  IntegrationApiKeyRequiredError,
} from './error';

import {
  JupiterOneApiClient,
  ApiClientResponse,
  ApiClientRequestConfig,
} from './apiClient';

import { createIntegrationLogger } from '../logger';

export type { ApiClientResponse, ApiClientRequestConfig };

/**
 * Public API client type exposed by the runtime.
 */
export type ApiClient = JupiterOneApiClient;

export interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  compressUploads?: boolean;
  logger?: IntegrationLogger;
}

/**
 * Internal-only type for detecting removed options and throwing clear errors.
 * Not exported — callers should not see these fields in the public API.
 */
interface UnsupportedCreateApiClientInput {
  alphaOptions?: unknown;
  proxyUrl?: unknown;
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
  logger,
  alphaOptions,
  proxyUrl,
}: CreateApiClientInput & UnsupportedCreateApiClientInput): ApiClient {
  if (alphaOptions !== undefined) {
    process.emitWarning(
      'alphaOptions is no longer supported and will be ignored. Use retryOptions instead.',
      'DeprecationWarning',
    );
  }
  if (proxyUrl !== undefined) {
    process.emitWarning(
      'proxyUrl is no longer supported and will be ignored. Use environment-level proxy configuration (e.g., HTTPS_PROXY) instead.',
      'DeprecationWarning',
    );
  }

  return new JupiterOneApiClient({
    baseUrl: apiBaseUrl,
    logger: logger ?? createIntegrationLogger({ name: 'api-client' }),
    account,
    accessToken,
    compressUploads,
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
