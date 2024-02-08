import { APIClient, defaultErrorHandler } from '../index';
import fetch, { Response } from 'node-fetch';
import { sleep } from '@lifeomic/attempt';

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@lifeomic/attempt', () => ({
  __esModule: true,
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const authHeadersFn = jest.fn();

class MockAPIClient extends APIClient {
  getAuthenticationHeaders() {
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
      });

      expect((client as any).retryOptions).toEqual({
        maxAttempts: 3,
        delay: 30_000,
        timeout: 180_000,
        factor: 2,
        handleError: defaultErrorHandler,
      });
    });

    it('should set the provided retry options', () => {
      const retryOptions = {
        maxAttempts: 5,
        delay: 60_000,
        timeout: 30_000,
        factor: 1.5,
        handleError: jest.fn(),
      };
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
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
      });

      const endpoint = '/test';
      const result = (client as any).withBaseUrl(endpoint);

      expect(result).toBe('https://api.example.com/test');
    });

    it('should handle endpoint starting with slash', () => {
      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com/',
        logger: mockLogger,
      });

      const endpoint = 'test';
      const result = (client as any).withBaseUrl(endpoint);

      expect(result).toBe('https://api.example.com/test');
    });
  });

  describe('request', () => {
    it('should not try to authenticate', async () => {
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
      });

      const endpoint = '/test';
      await (client as any).request(endpoint, {
        authenticate: false,
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

    it('should make a fetch request with correct parameters', async () => {
      authHeadersFn.mockReturnValue({
        Authorization: 'Bearer test-token',
      });
      const mockResponse = {} as Response;
      (fetch as unknown as jest.Mock).mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
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
  });

  describe('withRateLimiting', () => {
    it('should call the provided function and return response when rate limit throttling is not enabled', async () => {
      const mockResponse = {} as Response;
      const fn = jest.fn().mockResolvedValue(mockResponse);

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
      });

      const response = await (client as any).withRateLimiting(fn);

      expect(fn).toHaveBeenCalled();
      expect(response).toBe(mockResponse);
    });

    it('should throttle the next request when rate limit threshold is exceeded', async () => {
      const mockResponse = {} as Response;
      const fn = jest.fn().mockResolvedValueOnce(mockResponse);

      const rateLimitHeaders = new Headers();
      rateLimitHeaders.set('x-rate-limit-limit', '100');
      rateLimitHeaders.set('x-rate-limit-remaining', '40'); // 40 remaining, 60 consumed
      rateLimitHeaders.set(
        'x-rate-limit-reset',
        Math.floor(Date.now() / 1000 + 60).toString(),
      ); // Reset in 60 seconds

      (mockResponse as any).headers = rateLimitHeaders;

      const client = new MockAPIClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
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

  // Add more test cases for other methods as needed
});
