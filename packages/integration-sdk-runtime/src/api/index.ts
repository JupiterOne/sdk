import { AxiosInstance } from 'axios';
import Alpha from '@lifeomic/alpha';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import {
  IntegrationApiKeyRequiredError,
  IntegrationAccountRequiredError,
} from './error';

export type ApiClient = AxiosInstance;

interface CreateApiClientInput {
  apiBaseUrl: string;
  account: string;
  accessToken?: string;
  retryOptions?: RetryOptions;
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
}: CreateApiClientInput): ApiClient {
  const headers: Record<string, string> = {
    'LifeOmic-Account': account,
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return new Alpha({
    baseURL: apiBaseUrl,
    headers,
    retry: retryOptions,
  }) as ApiClient;
}

interface GetApiBaseUrlInput {
  dev: boolean;
}

export function getApiBaseUrl({ dev }: GetApiBaseUrlInput = { dev: false }) {
  if (dev) {
    return 'https://api.dev.jupiterone.io';
  }

  return 'https://api.us.jupiterone.io';
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
