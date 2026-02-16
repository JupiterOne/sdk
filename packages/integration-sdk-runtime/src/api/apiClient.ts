import { BaseAPIClient } from '@jupiterone/integration-sdk-http-client';
import type { IntegrationLogger } from '@jupiterone/integration-sdk-core';

export interface ApiClientResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface ApiClientRequestConfig {
  headers?: Record<string, string>;
  rawBody?: Buffer;
}

interface JupiterOneApiClientConfig {
  baseUrl: string;
  logger: IntegrationLogger;
  account: string;
  accessToken?: string;
  compressUploads?: boolean;
}

export class JupiterOneApiClient extends BaseAPIClient {
  _compressUploads: boolean;

  private account: string;
  private accessToken?: string;

  constructor(config: JupiterOneApiClientConfig) {
    super({
      baseUrl: config.baseUrl,
      logger: config.logger,
      integrationConfig: {},
    });
    this.account = config.account;
    this.accessToken = config.accessToken;
    this._compressUploads = config.compressUploads !== false;
  }

  protected getAuthorizationHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'JupiterOne-Account': this.account,
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    return headers;
  }
}
