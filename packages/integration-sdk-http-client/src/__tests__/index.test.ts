import { IntegrationProviderAuthenticationError } from '@jupiterone/integration-sdk-core';
import { BaseAPIClient } from '../client';
import { sleep } from '@lifeomic/attempt';
import FormData from 'form-data';
import https from 'node:https';

jest.mock('node-fetch');
import fetch from 'node-fetch';

const { Response, Headers } = jest.requireActual('node-fetch');

jest.mock('@lifeomic/attempt', () => {
  const originalModule = jest.requireActual('@lifeomic/attempt');

  return {
    __esModule: true,
    ...originalModule,
    sleep: jest.fn().mockResolvedValue(undefined),
  };
});

const authHeadersFn = jest.fn();

class MockAPIClient extends BaseAPIClient {
  getAuthorizationHeaders() {
    return authHeadersFn();
  }
}

describe('APIClient', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default retry options if not provided', () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      expect((client as any).retryOptions).toEqual({
        maxAttempts: 3,
        delay: 30_000,
        timeout: 180_000,
        factor: 2,
        timeoutMaxAttempts: 3,
      });
    });

    it('should set the provided retry options', () => {
      const retryOptions = {
        maxAttempts: 5,
        delay: 60_000,
        timeout: 30_000,
        factor: 1.5,
        timeoutMaxAttempts: 2,
      };
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
        retryOptions,
      });

      expect((client as any).retryOptions).toEqual(retryOptions);
    });
  });

  describe('withBaseUrl', () => {
    it('should return the endpoint with the base URL', () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com/',
        logger: mockLogger,
        integrationConfig: {},
      });

      const endpoint = '/test';
      const result = (client as any).withBaseUrl(endpoint);

      expect(result).toBe('https://api.example.com/test');
    });

    it('should handle endpoint starting with slash', () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com/',
        logger: mockLogger,
        integrationConfig: {},
      });

      const endpoint = 'test';
      const result = (client as any).withBaseUrl(endpoint);

      expect(result).toBe('https://api.example.com/test');
    });

    it('should handle base url with base path', () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com/api/v1',
        logger: mockLogger,
        integrationConfig: {},
      });
      const endpoint = 'test/1';
      const result = (client as any).withBaseUrl(endpoint);
      expect(result).toBe('https://api.example.com/api/v1/test/1');

      const endpoint2 = '/test/1';
      const result2 = (client as any).withBaseUrl(endpoint2);
      expect(result2).toBe('https://api.example.com/api/v1/test/1');
    });

    it('should not encode characters', () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com/api/v1',
        logger: mockLogger,
        integrationConfig: {},
      });

      const endpoint = '/test?param1=1&param2=2';
      const result = (client as any).withBaseUrl(endpoint);

      expect(result).toBe(
        'https://api.example.com/api/v1/test?param1=1&param2=2',
      );
    });
  });

  describe('request', () => {
    it('should not try to authorize', async () => {
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      const endpoint = '/test';
      await (client as any).request(endpoint, {
        authorize: false,
      });

      expect(authHeadersFn).toHaveBeenCalledTimes(0);
      expect(fetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: undefined,
      });
    });

    it('should try to authorize again when 401/403 errors are received', async () => {
      (fetch as unknown as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: [],
      });

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
        refreshAuth: { enabled: true },
      });

      const endpoint = '/test';
      await expect(
        (client as any).retryableRequest(endpoint, {
          method: 'GET',
          body: { test: 'test' },
        }),
      ).rejects.toThrow(IntegrationProviderAuthenticationError);

      expect(authHeadersFn).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledTimes(2);
    }, 50_000);

    it('should make a fetch request with correct parameters', async () => {
      authHeadersFn.mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      const endpoint = '/test';
      await (client as any).request(endpoint, {
        method: 'GET',
        body: { test: 'test' },
      });

      expect(authHeadersFn).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: `{"test":"test"}`,
      });
    });

    it('should call the protected method getDefaultAgent if integration configs includes disableTlsVerification', async () => {
      authHeadersFn.mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {
          disableTlsVerification: true,
        },
      });

      const spy = jest.spyOn(client as any, 'getDefaultAgent' as any);

      const endpoint = '/test';
      await (client as any).request(endpoint, {
        method: 'GET',
        body: { test: 'test' },
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should call the protected method getDefaultAgent if integration configs includes caCertificate', async () => {
      authHeadersFn.mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {
          caCertificate: true,
        },
      });

      const spy = jest.spyOn(client as any, 'getDefaultAgent' as any);

      const endpoint = '/test';
      await (client as any).request(endpoint, {
        method: 'GET',
        body: { test: 'test' },
      });

      expect(spy).toHaveBeenCalled();
    });

    it('should NOT call the protected method getDefaultAgent if a custom agent in passed within request options', async () => {
      authHeadersFn.mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      const spy = jest.spyOn(client as any, 'getDefaultAgent' as any);

      const endpoint = '/test';
      await (client as any).request(endpoint, {
        method: 'GET',
        body: { test: 'test' },
        agent: new https.Agent(),
      });

      expect(spy).not.toHaveBeenCalled();
    });

    it('should use HTTP_PROXY environment variable if set', async () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';

      authHeadersFn.mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      await (client as any).request('/test', {
        method: 'GET',
        body: { test: 'test' },
      });

      // Check that fetch was called with an agent that is a HttpsProxyAgent and has the correct proxy URL
      const fetchOptions = (fetch as unknown as jest.Mock).mock.calls[0][1];
      const { HttpsProxyAgent } = require('https-proxy-agent');
      expect(fetchOptions.agent).toBeInstanceOf(HttpsProxyAgent);
      expect(
        fetchOptions.agent.proxy?.href ||
        fetchOptions.agent.options?.proxy?.href ||
        fetchOptions.agent.options?.url // fallback for some versions
      ).toContain('http://proxy.example.com:8080');

      delete process.env.HTTP_PROXY;
    });

    describe('fmtBody', () => {
      test('should format body as JSON string when bodyType is json', async () => {
        const mockResponse = {} as Response;
        (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

        const client = new MockAPIClient({
          baseUrl: 'https://api.example.com',
          logger: mockLogger,
          integrationConfig: {},
        });

        const body = { key1: 'value1', key2: 'value2' };
        await (client as any).request('/test', {
          bodyType: 'json',
          body,
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify(body),
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          }),
        );
      });

      test('should format body as plain text when bodyType is text', async () => {
        const mockResponse = {} as Response;
        (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

        const client = new MockAPIClient({
          baseUrl: 'https://api.example.com',
          logger: mockLogger,
          integrationConfig: {},
        });

        const body = 'plain text body';
        await (client as any).request('/test', {
          bodyType: 'text',
          body,
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body,
            headers: expect.objectContaining({
              'Content-Type': 'text/plain',
            }),
          }),
        );
      });

      test('should format body as FormData when bodyType is form', async () => {
        const mockResponse = {} as Response;
        (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

        const client = new MockAPIClient({
          baseUrl: 'https://api.example.com',
          logger: mockLogger,
          integrationConfig: {},
        });

        const body = { key1: 'value1', key2: 'value2' };
        const appendSpy = jest.spyOn(FormData.prototype, 'append');
        const getHeadersSpy = jest.spyOn(FormData.prototype, 'getHeaders');
        getHeadersSpy.mockReturnValue({
          'content-type': 'multipart/form-data',
        });

        await (client as any).request('/test', {
          bodyType: 'form',
          body,
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'content-type': 'multipart/form-data',
            }),
          }),
        );

        expect(appendSpy).toHaveBeenCalledWith('key1', 'value1');
        expect(appendSpy).toHaveBeenCalledWith('key2', 'value2');
      });

      test('should throw an error when bodyType is form and a non-string value is provided', async () => {
        const mockResponse = {} as Response;
        (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

        const client = new MockAPIClient({
          baseUrl: 'https://api.example.com',
          logger: mockLogger,
          integrationConfig: {},
        });

        const body = { key1: 'value1', key2: 123 }; // Invalid value
        await expect(
          (client as any).request('/test', { bodyType: 'form', body }),
        ).rejects.toThrow('Form data values must be strings');
      });

      test('should format body as URLSearchParams when bodyType is urlencoded', async () => {
        const mockResponse = {} as Response;
        (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

        const client = new MockAPIClient({
          baseUrl: 'https://api.example.com',
          logger: mockLogger,
          integrationConfig: {},
        });

        const body = { key1: 'value1', key2: 'value2' };
        await (client as any).request('/test', {
          bodyType: 'urlencoded',
          body,
        });

        expect(fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.any(URLSearchParams),
            headers: expect.objectContaining({
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
          }),
        );

        const urlSearchParams = (fetch as unknown as jest.Mock).mock.calls[0][1]
          .body as URLSearchParams;
        expect(urlSearchParams.get('key1')).toBe('value1');
        expect(urlSearchParams.get('key2')).toBe('value2');
      });

      test('should throw an error when bodyType is urlencoded and a non-string value is provided', async () => {
        const mockResponse = {} as Response;
        (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

        const client = new MockAPIClient({
          baseUrl: 'https://api.example.com',
          logger: mockLogger,
          integrationConfig: {},
        });

        const body = { key1: 'value1', key2: 123 }; // Invalid value
        await expect(
          (client as any).request('/test', { bodyType: 'urlencoded', body }),
        ).rejects.toThrow('Form values must be strings');
      });
    });
  });

  describe('withRateLimiting', () => {
    it('should call the provided function and return response when rate limit throttling is not enabled', async () => {
      const mockResponse = {} as Response;
      const fn = jest.fn().mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      const response = await (client as any).withRateLimiting(fn);

      expect(fn).toHaveBeenCalled();
      expect(response).toBe(mockResponse);
    });

    it('should throttle the next request when rate limit threshold is exceeded', async () => {
      const mockResponse = {} as Response;
      const fn = jest.fn().mockResolvedValueOnce(mockResponse);

      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set('ratelimit-limit', '100');
      rateLimitHeaders.set('ratelimit-remaining', '40'); // 40 remaining, 60 consumed
      rateLimitHeaders.set('ratelimit-reset', '60'); // Reset in 60 seconds

      (mockResponse as any).headers = rateLimitHeaders;

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
        rateLimitThrottling: {
          threshold: 0.5,
        },
      });

      await (client as any).withRateLimiting(fn);

      expect(fn).toHaveBeenCalledTimes(1); // Function called three times
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(sleep).toHaveBeenCalled(); // Sleep function called to throttle request
      expect(sleep).toHaveBeenCalledWith(expect.any(Number));
      const sleepArg = (sleep as jest.Mock).mock.calls[0][0];
      expect(sleepArg).toBeGreaterThan(60_000); // Sleep for 60 + 1 seconds
    });
  });

  describe('paginate', () => {
    it('should handle pagination correctly', async () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        integrationConfig: {},
      });

      const mockResponses = [
        new Response(
          JSON.stringify({ items: [{ id: '1' }, { id: '2' }], nextPage: 2 }),
        ),
        new Response(JSON.stringify({ items: [{ id: '3' }], nextPage: null })), // Indicate the end of pagination
      ];

      (fetch as unknown as jest.Mock)
        .mockResolvedValueOnce(mockResponses[0])
        .mockResolvedValueOnce(mockResponses[1]);
      // Define test data
      const initialRequest = { endpoint: 'https://example.com/api' };
      const dataPath = 'items';
      const nextPageCallback = jest.fn().mockImplementation((data) => {
        const { body } = data;
        if (!body.nextPage) {
          return;
        }
        return {
          nextUrl: `https://example.com/api?page=${body.nextPage}`,
        };
      });

      // Initialize the generator
      const generator = (client as any).paginate(
        initialRequest,
        dataPath,
        nextPageCallback,
      );

      // Fetch the first page
      let result = await generator.next();
      expect(result.value).toEqual({ id: '1' });
      result = await generator.next();
      expect(result.value).toEqual({ id: '2' });

      // Fetch the second page
      result = await generator.next();
      expect(result.value).toEqual({ id: '3' });

      // Ensure the generator completes
      result = await generator.next();
      expect(result.done).toBeTruthy();

      // Verify mock calls
      expect(fetch).toHaveBeenCalledTimes(2); // Assuming two fetch calls, one for each page
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        'https://example.com/api',
        expect.any(Object),
      );
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://example.com/api?page=2',
        expect.any(Object),
      );
    });
  });
});
