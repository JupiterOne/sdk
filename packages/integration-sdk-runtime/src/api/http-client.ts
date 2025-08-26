import { request } from 'undici';
import { URL } from 'url';

export interface HttpClientOptions {
  baseURL: string;
  headers?: Record<string, string>;
  timeout?: number;
  proxy?: string;
  retry?: {
    attempts?: number;
    factor?: number;
    maxTimeout?: number;
    retryCondition?: (err: Error) => boolean;
  };
}

export interface HttpClientResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface HttpClientRequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
}

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retryOptions: HttpClientOptions['retry'];

  constructor(options: HttpClientOptions) {
    this.baseURL = options.baseURL;
    this.defaultHeaders = options.headers || {};
    this.timeout = options.timeout || 30000;
    this.retryOptions = options.retry || {};
  }

  private async makeRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    const fullUrl = new URL(url, this.baseURL).toString();
    const headers = { ...this.defaultHeaders, ...config?.headers };

    if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const requestOptions = {
      method,
      headers,
      body: data
        ? Buffer.isBuffer(data)
          ? data
          : JSON.stringify(data)
        : undefined,
      signal: AbortSignal.timeout(config?.timeout || this.timeout),
    };

    const response = await request(fullUrl, requestOptions);

    let responseData: T;
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      responseData = (await response.body.json()) as T;
    } else {
      responseData = (await response.body.text()) as T;
    }

    return {
      data: responseData,
      status: response.statusCode,
      statusText: response.statusCode.toString(),
      headers: response.headers as Record<string, string>,
    };
  }

  private async retryRequest<T = any>(
    requestFn: () => Promise<HttpClientResponse<T>>,
  ): Promise<HttpClientResponse<T>> {
    const {
      attempts = 3,
      factor = 2,
      maxTimeout = 30000,
      retryCondition,
    } = this.retryOptions || {};

    let lastError: Error;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (retryCondition && !retryCondition(lastError)) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === attempts) {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          Math.pow(factor, attempt - 1) * 1000,
          maxTimeout,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  async get<T = any>(
    url: string,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return this.retryRequest(() =>
      this.applyInterceptors<T>('GET', url, undefined, config),
    );
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return this.retryRequest(() =>
      this.applyInterceptors<T>('POST', url, data, config),
    );
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return this.retryRequest(() =>
      this.applyInterceptors<T>('PUT', url, data, config),
    );
  }

  async delete<T = any>(
    url: string,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return this.retryRequest(() =>
      this.applyInterceptors<T>('DELETE', url, undefined, config),
    );
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    return this.retryRequest(() =>
      this.applyInterceptors<T>('PATCH', url, data, config),
    );
  }

  // Interceptor support for compatibility
  interceptors = {
    request: {
      use: (handler: (config: any) => any) => {
        // Store request interceptor for future use
        this.requestInterceptor = handler;
      },
    },
    response: {
      use: (
        onFulfilled?: (response: any) => any,
        onRejected?: (error: any) => any,
      ) => {
        // Store response interceptors for future use
        this.responseFulfilledInterceptor = onFulfilled;
        this.responseRejectedInterceptor = onRejected;
      },
    },
  };

  private requestInterceptor?: (config: any) => any;
  private responseFulfilledInterceptor?: (response: any) => any;
  private responseRejectedInterceptor?: (error: any) => any;

  // Method to apply interceptors (to be called before making requests)
  private async applyInterceptors<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    config?: HttpClientRequestConfig,
  ): Promise<HttpClientResponse<T>> {
    let requestConfig = { method, url, data, ...config };

    // Apply request interceptor
    if (this.requestInterceptor) {
      requestConfig = await this.requestInterceptor(requestConfig);
    }

    try {
      const response = await this.makeRequest<T>(
        requestConfig.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        requestConfig.url,
        requestConfig.data,
        requestConfig,
      );

      // Apply response fulfilled interceptor
      if (this.responseFulfilledInterceptor) {
        return await this.responseFulfilledInterceptor(response);
      }

      return response;
    } catch (error) {
      // Apply response rejected interceptor
      if (this.responseRejectedInterceptor) {
        throw await this.responseRejectedInterceptor(error);
      }
      throw error;
    }
  }
}
