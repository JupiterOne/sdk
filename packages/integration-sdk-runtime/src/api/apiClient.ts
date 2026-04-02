import type { Agent } from 'https';
import { promisify } from 'util';
import { gzip } from 'zlib';
import {
  BaseAPIClient,
  RequestOptions,
  Response,
} from '@jupiterone/integration-sdk-http-client';
import type { IntegrationLogger } from '@jupiterone/integration-sdk-core';

const gzipData = promisify(gzip);

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
  retryOptions?: Partial<{
    maxAttempts: number;
    delay: number;
    factor: number;
    timeout: number;
  }>;
  agent?: Agent;
}

export class JupiterOneApiClient extends BaseAPIClient {
  _compressUploads: boolean;

  private account: string;
  private accessToken?: string;
  private _proxyAgent?: Agent;

  constructor(config: JupiterOneApiClientConfig) {
    super({
      baseUrl: config.baseUrl,
      logger: config.logger,
      integrationConfig: {},
      retryOptions: config.retryOptions,
    });
    this.account = config.account;
    this.accessToken = config.accessToken;
    this._compressUploads = config.compressUploads !== false;
    this._proxyAgent = config.agent;
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
   * Override request() to inject the proxy agent when configured.
   * rawBody support is handled by BaseAPIClient.request().
   */
  protected request(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<Response> {
    if (this._proxyAgent) {
      return super.request(endpoint, {
        ...(options ?? {}),
        agent: this._proxyAgent,
      });
    }

    return super.request(endpoint, options);
  }

  async post<T>(
    url: string,
    data?: Record<string, unknown> | string,
    config?: ApiClientRequestConfig,
  ): Promise<ApiClientResponse<T>> {
    if (this._compressUploads && data && !config?.rawBody) {
      const serialized = typeof data === 'string' ? data : JSON.stringify(data);
      const compressed = await gzipData(Buffer.from(serialized));
      return this.executeRequest<T>(url, {
        method: 'POST',
        headers: {
          ...config?.headers,
          'Content-Encoding': 'gzip',
        },
        rawBody: compressed,
      });
    }

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
    options: RequestOptions,
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

  protected redactAuthHeaders(err: unknown): void {
    const e = err as Record<string, Record<string, unknown>> | undefined;
    if (e?.config?.headers) {
      e.config.headers = '[REDACTED]';
    }
    const response = e?.response as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (response?.config?.headers) {
      response.config.headers = '[REDACTED]';
    }
  }
}
