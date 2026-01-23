import { mocked } from 'jest-mock';
import { createRequestClient } from '@jupiterone/platform-sdk-fetch';

import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClient,
  getAccountFromEnvironment,
  compressRequest,
} from '../index';

// Mock createRequestClient to return a mock client
const mockPost = jest.fn();
const mockGet = jest.fn();
const mockInterceptors = {
  request: { use: jest.fn(), eject: jest.fn() },
  response: { use: jest.fn(), eject: jest.fn() },
};

jest.mock('@jupiterone/platform-sdk-fetch', () => ({
  createRequestClient: jest.fn().mockImplementation(() => ({
    post: mockPost,
    get: mockGet,
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    head: jest.fn(),
    options: jest.fn(),
    interceptors: mockInterceptors,
  })),
}));

const createRequestClientMock = mocked(createRequestClient);

describe('getApiBaseUrl', () => {
  test('returns development base url if dev option is set to true', () => {
    expect(getApiBaseUrl({ dev: true })).toEqual(
      'https://api.dev.jupiterone.io',
    );
  });

  test('returns production base url if dev option is set to false', () => {
    expect(getApiBaseUrl({ dev: false })).toEqual(
      'https://api.us.jupiterone.io',
    );
  });

  test('defaults to returning the production base url', () => {
    expect(getApiBaseUrl()).toEqual('https://api.us.jupiterone.io');
  });
});

describe('getApiKeyFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_API_KEY;
  });

  test('returns JUPITERONE_API_KEY environment variable value', () => {
    const apiKey = getApiKeyFromEnvironment();

    expect(apiKey).toEqual('test-key');
  });

  test('throws error if JUPITERONE_API_KEY is not set', () => {
    delete process.env.JUPITERONE_API_KEY;
    expect(() => getApiKeyFromEnvironment()).toThrow(
      /JUPITERONE_API_KEY environment variable must be set/,
    );
  });
});

describe('getAccountFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_ACCOUNT = 'test-account';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_ACCOUNT;
  });

  test('returns JUPITERONE_ACCOUNT environment variable value', () => {
    const account = getAccountFromEnvironment();

    expect(account).toEqual('test-account');
  });

  test('throws error if JUPITERONE_ACCOUNT is not set', () => {
    delete process.env.JUPITERONE_ACCOUNT;
    expect(() => getAccountFromEnvironment()).toThrow(
      /JUPITERONE_ACCOUNT environment variable must be set/,
    );
  });
});

describe('createApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('successfully creates apiClient', () => {
    const apiBaseUrl = getApiBaseUrl();

    const client = createApiClient({
      apiBaseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: {
        maxTimeout: 20000,
      },
    });

    expect(client).toBeDefined();
    expect(client.post).toBeDefined();
    expect(client.get).toBeDefined();
    expect(client.interceptors).toBeDefined();

    expect(createRequestClientMock).toHaveBeenCalledTimes(1);
    expect(createRequestClientMock).toHaveBeenCalledWith({
      baseURL: apiBaseUrl,
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
        'JupiterOne-Account': 'test-account',
      },
      retry: {
        maxTimeout: 20000,
      },
    });
  });

  test('creates client without accessToken', () => {
    const apiBaseUrl = getApiBaseUrl();

    createApiClient({
      apiBaseUrl,
      account: 'test-account',
    });

    expect(createRequestClientMock).toHaveBeenCalledWith({
      baseURL: apiBaseUrl,
      headers: {
        'Content-Type': 'application/json',
        'JupiterOne-Account': 'test-account',
      },
      retry: {},
    });
  });

  test('registers response interceptor for error redaction', () => {
    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
    });

    expect(mockInterceptors.response.use).toHaveBeenCalled();
  });

  test('registers request interceptor when compressUploads is true', () => {
    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: true,
    });

    expect(mockInterceptors.request.use).toHaveBeenCalled();
  });

  test('does not register request interceptor when compressUploads is false', () => {
    jest.clearAllMocks();

    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: false,
    });

    expect(mockInterceptors.request.use).not.toHaveBeenCalled();
  });
});

describe('compressRequest', () => {
  it('should add gzip header when the URL matches entities endpoint', async () => {
    const config = {
      method: 'POST' as const,
      url: '/persister/synchronization/jobs/478d5718-69a7-4204-90b7-7d9f01de374f/entities',
      headers: {},
    };

    const result = await compressRequest(config);

    expect(result.headers!['Content-Encoding']).toBe('gzip');
  });

  it('should add gzip header when the URL matches relationships endpoint', async () => {
    const config = {
      method: 'POST' as const,
      url: '/persister/synchronization/jobs/478d5718-69a7-4204-90b7-7d9f01de374f/relationships',
      headers: {},
    };

    const result = await compressRequest(config);

    expect(result.headers!['Content-Encoding']).toBe('gzip');
  });

  it('should not add gzip header when the URL does not match', async () => {
    const config = {
      method: 'POST' as const,
      url: '/other-url',
      headers: {},
    };

    const result = await compressRequest(config);

    expect(result.headers!['Content-Encoding']).toBeUndefined();
  });

  it('should not add gzip header for non-POST methods', async () => {
    const config = {
      method: 'GET' as const,
      url: '/persister/synchronization/jobs/478d5718-69a7-4204-90b7-7d9f01de374f/entities',
      headers: {},
    };

    const result = await compressRequest(config);

    expect(result.headers!['Content-Encoding']).toBeUndefined();
  });
});

describe('real RequestClient request with fake API key', () => {
  test('should not expose API key in error', async () => {
    jest.resetModules();
    jest.unmock('@jupiterone/platform-sdk-fetch');

    const { createApiClient, getApiBaseUrl } = require('../index');

    const apiBaseUrl = getApiBaseUrl();

    const client = createApiClient({
      apiBaseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: {
        maxTimeout: 20000,
      },
    });

    try {
      await client.post('/persister/synchronization/jobs/', { some: 'data' });
    } catch (err: any) {
      const errorString = JSON.stringify(err);

      expect(errorString).not.toContain('test-key');
    }
  });
});
