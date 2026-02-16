import fetch from 'node-fetch';
import type { Response } from 'node-fetch';
import {
  BaseAPIClient,
  RequestOptions,
} from '@jupiterone/integration-sdk-http-client';
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

interface ExtendedRequestOptions extends RequestOptions {
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

  /**
   * Override request() to support rawBody (Buffer) for gzip-compressed uploads.
   * When rawBody is present, call node-fetch directly (BaseAPIClient's body
   * serialization doesn't support Buffer). Otherwise delegate to super.request().
   */
  protected async request(
    endpoint: string,
    options?: ExtendedRequestOptions,
  ): Promise<Response> {
    if (options?.rawBody) {
      if (!this.authorizationHeaders) {
        this.authorizationHeaders = this.getAuthorizationHeaders();
      }

      let url: string;
      try {
        url = new URL(endpoint).toString();
      } catch {
        url = this.withBaseUrl(endpoint);
      }

      const response = await fetch(url, {
        method: options.method ?? 'POST',
        headers: {
          ...this.authorizationHeaders,
          ...options.headers,
        },
        body: options.rawBody,
      });
      return response;
    }

    return super.request(endpoint, options);
  }

  async post<T>(
    url: string,
    data?: Record<string, unknown> | string,
    config?: ApiClientRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    return this.executeRequest<T>(url, {
      method: 'POST',
      body: data,
      headers: config?.headers,
      rawBody: config?.rawBody,
    });
  }

  async get<T>(
    url: string,
    config?: ApiClientRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    return this.executeRequest<T>(url, {
      method: 'GET',
      headers: config?.headers,
    });
  }

  private async executeRequest<T>(
    url: string,
    options: ExtendedRequestOptions,
  ): Promise<ApiClientResponse<T>> {
    try {
      const response = await this.retryableRequest(url, options);
      const data = (await response.json()) as T;
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return { data, status: response.status, headers };
    } catch (err) {
      this.redactAuthHeaders(err);
      throw err;
    }
  }

  private redactAuthHeaders(err: any): void {
    if (err?.config?.headers) {
      err.config.headers = '[REDACTED]';
    }
    if (err?.response?.config?.headers) {
      err.response.config.headers = '[REDACTED]';
    }
  }
}
