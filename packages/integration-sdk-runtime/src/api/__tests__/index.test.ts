import { mocked } from 'jest-mock';
import { createRequestClient } from '@jupiterone/platform-sdk-fetch';

import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClient,
  getAccountFromEnvironment,
  isUploadCompressionEnabled,
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

  test('sets _compressUploads flag when compressUploads is true', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: true,
    });

    expect(client._compressUploads).toBe(true);
    expect(isUploadCompressionEnabled(client)).toBe(true);
  });

  test('throws error when alphaOptions is provided', () => {
    expect(() =>
      createApiClient(
        // @ts-expect-error - Testing that deprecated alphaOptions throws at runtime
        {
          apiBaseUrl: 'https://api.example.com',
          account: 'test-account',
          alphaOptions: {},
        },
      ),
    ).toThrow('alphaOptions is no longer supported');
  });

  test('throws error when proxyUrl is provided', () => {
    expect(() =>
      createApiClient(
        // @ts-expect-error - Testing that deprecated proxyUrl throws at runtime
        {
          apiBaseUrl: 'https://api.example.com',
          account: 'test-account',
          proxyUrl: 'http://proxy:8080',
        },
      ),
    ).toThrow('proxyUrl is no longer supported');
  });

  test('does not set _compressUploads flag when compressUploads is false', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: false,
    });

    expect(client._compressUploads).toBeUndefined();
    expect(isUploadCompressionEnabled(client)).toBe(false);
  });
});

describe('isUploadCompressionEnabled', () => {
  it('should return true when _compressUploads is true', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      compressUploads: true,
    });

    expect(isUploadCompressionEnabled(client)).toBe(true);
  });

  it('should return true when _compressUploads is undefined (default enabled)', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
    });

    expect(isUploadCompressionEnabled(client)).toBe(true);
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
  }, 30000); // 30 second timeout for real network request
});
