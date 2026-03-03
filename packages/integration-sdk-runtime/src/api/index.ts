import {
  IntegrationError,
  IntegrationLogger,
} from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { HttpsProxyAgent } from 'https-proxy-agent';

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

/**
 * Retry options matching the original @lifeomic/alpha shape for backwards
 * compatibility. Mapped to the http-client's RetryOptions internally.
 */
export interface RetryOptions {
  attempts?: number;
  factor?: number;
  maxTimeout?: number;
  /**
   * @deprecated retryCondition is not supported by the new http-client.
   * Custom retry logic should be implemented via retryErrorHandler override.
   */
  retryCondition?: (err: Error) => boolean;
}

export interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
  compressUploads?: boolean;
  proxyUrl?: string;
  logger?: IntegrationLogger;
}

/**
 * Internal-only type for detecting removed options and throwing clear errors.
 * Not exported — callers should not see these fields in the public API.
 */
interface UnsupportedCreateApiClientInput {
  alphaOptions?: unknown;
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
  proxyUrl,
  logger,
  alphaOptions,
}: CreateApiClientInput & UnsupportedCreateApiClientInput): ApiClient {
  if (alphaOptions !== undefined) {
    process.emitWarning(
      'alphaOptions is no longer supported and will be ignored. Use retryOptions instead.',
      'DeprecationWarning',
    );
  }
  if (retryOptions?.retryCondition !== undefined) {
    process.emitWarning(
      'retryCondition is not supported by the new http-client and will be ignored. Override retryErrorHandler on the client instead.',
      'DeprecationWarning',
    );
  }

  // Map old RetryOptions shape to http-client's Partial<RetryOptions>
  const mappedRetryOptions = retryOptions
    ? {
        ...(retryOptions.attempts !== undefined && {
          maxAttempts: retryOptions.attempts,
        }),
        ...(retryOptions.factor !== undefined && {
          factor: retryOptions.factor,
        }),
        ...(retryOptions.maxTimeout !== undefined && {
          timeout: retryOptions.maxTimeout,
        }),
      }
    : undefined;

  const proxyUrlString = proxyUrl || getProxyFromEnvironment();
  const agent = proxyUrlString
    ? new HttpsProxyAgent(proxyUrlString)
    : undefined;

  return new JupiterOneApiClient({
    baseUrl: apiBaseUrl,
    logger: logger ?? createIntegrationLogger({ name: 'api-client' }),
    account,
    accessToken,
    compressUploads,
    retryOptions: mappedRetryOptions,
    agent,
  });
}

function getProxyFromEnvironment(): string | undefined {
  dotenvExpand(dotenv.config());
  return process.env.HTTPS_PROXY || process.env.https_proxy;
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
