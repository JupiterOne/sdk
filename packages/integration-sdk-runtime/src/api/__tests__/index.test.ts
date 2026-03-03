import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClient,
  getAccountFromEnvironment,
} from '../index';

import { JupiterOneApiClient } from '../apiClient';

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
  test('returns a JupiterOneApiClient instance', () => {
    const apiBaseUrl = getApiBaseUrl();

    const client = createApiClient({
      apiBaseUrl,
      account: 'test-account',
      accessToken: 'test-key',
    });

    expect(client).toBeInstanceOf(JupiterOneApiClient);
    expect(client.post).toBeDefined();
    expect(client.get).toBeDefined();
  });

  test('creates client without accessToken', () => {
    const apiBaseUrl = getApiBaseUrl();

    const client = createApiClient({
      apiBaseUrl,
      account: 'test-account',
    });

    expect(client).toBeInstanceOf(JupiterOneApiClient);
  });

  test('sets _compressUploads flag when compressUploads is true', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: true,
    });

    expect(client._compressUploads).toBe(true);
  });

  test('warns when alphaOptions is provided', () => {
    const warnSpy = jest.spyOn(process, 'emitWarning').mockImplementation();
    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      alphaOptions: {},
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'alphaOptions is no longer supported and will be ignored. Use retryOptions instead.',
      'DeprecationWarning',
    );
    warnSpy.mockRestore();
  });

  test('warns when retryCondition is provided', () => {
    const warnSpy = jest.spyOn(process, 'emitWarning').mockImplementation();
    createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      retryOptions: {
        retryCondition: () => true,
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'retryCondition is not supported by the new http-client and will be ignored. Override retryErrorHandler on the client instead.',
      'DeprecationWarning',
    );
    warnSpy.mockRestore();
  });

  test('passes retryOptions mapped to http-client shape', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: {
        attempts: 5,
        factor: 2,
        maxTimeout: 30000,
      },
    });

    expect(client).toBeInstanceOf(JupiterOneApiClient);
  });

  test('creates client with proxy agent when proxyUrl is provided', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      proxyUrl: 'http://proxy.example.com:8080',
    });

    expect(client).toBeInstanceOf(JupiterOneApiClient);
  });

  test('creates client with proxy agent from HTTPS_PROXY env var', () => {
    process.env.HTTPS_PROXY = 'http://env-proxy:3128';
    try {
      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-key',
      });

      expect(client).toBeInstanceOf(JupiterOneApiClient);
    } finally {
      delete process.env.HTTPS_PROXY;
    }
  });

  test('does not set _compressUploads flag when compressUploads is false', () => {
    const client = createApiClient({
      apiBaseUrl: 'https://api.example.com',
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: false,
    });

    expect(client._compressUploads).toBe(false);
  });
});
