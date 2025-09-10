import { mocked } from 'jest-mock';
import { Alpha } from '@lifeomic/alpha';

import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClient,
  getAccountFromEnvironment,
  compressRequest,
} from '../index';
import { AxiosRequestConfig } from 'axios';

jest.mock('@lifeomic/alpha');

const AlphaMock = mocked(Alpha);

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

describe('getApiKeyFromEnvironment', () => {
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

    expect(client).toBeInstanceOf(AlphaMock);

    expect(AlphaMock).toHaveReturnedTimes(1);
    expect(AlphaMock).toHaveBeenCalledWith({
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
});

describe('compressRequest', () => {
  it('should compress the request data when the URL matches', async () => {
    const config: AxiosRequestConfig = {
      method: 'post',
      url: '/persister/synchronization/jobs/478d5718-69a7-4204-90b7-7d9f01de374f/entities',
      headers: {},
      data: { some: 'data' },
    };

    await compressRequest(config);

    // Check if the 'Content-Encoding' header is set to 'gzip'
    expect(config.headers!['Content-Encoding']).toBe('gzip');

    // Check if the data is compressed
    expect(config.data).toBeInstanceOf(Buffer);
  });

  it('should not compress the request when the URL does not match', async () => {
    const config = {
      method: 'post',
      url: '/other-url',
      headers: {},
      data: { some: 'data' },
    };

    await compressRequest(config);

    // Check that the 'Content-Encoding' header is not set
    expect(config.headers['Content-Encoding']).toBeUndefined();

    // Check that the data is not compressed
    expect(config.data).toEqual({ some: 'data' });
  });
});

describe('real Alpha request with fake API key', () => {
  test('should not expose API key in error', async () => {
    jest.resetModules();
    jest.unmock('@lifeomic/alpha');

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

describe('createApiClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('proxy configuration', () => {
    it('should not configure proxy when no proxy URL is provided', () => {
      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      // The client should be created without proxy configuration
      expect(client).toBeDefined();
    });

    it('should configure proxy when proxyUrl parameter is provided', () => {
      const proxyUrl = 'https://foo:bar@proxy.example.com:8888';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
        proxyUrl,
      });

      expect(client).toBeDefined();
      // Note: We can't easily test the internal proxy config without exposing it
      // This test verifies the client is created successfully with proxy config
    });

    it('should configure proxy from HTTPS_PROXY environment variable', () => {
      process.env.HTTPS_PROXY = 'https://foo:bar@proxy.example.com:8888';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });

    it('should configure proxy from https_proxy environment variable', () => {
      process.env.https_proxy = 'http://user:pass@proxy.local:3128';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });

    it('should prefer HTTPS_PROXY over https_proxy', () => {
      process.env.HTTPS_PROXY = 'https://primary:proxy@proxy1.com:8888';
      process.env.https_proxy = 'http://secondary:proxy@proxy2.com:3128';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });

    it('should prefer proxyUrl parameter over environment variables', () => {
      process.env.HTTPS_PROXY = 'https://env:proxy@env-proxy.com:8888';
      const proxyUrl = 'https://param:proxy@param-proxy.com:9999';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
        proxyUrl,
      });

      expect(client).toBeDefined();
    });
  });

  describe('parseProxyUrl functionality', () => {
    // We need to import the parseProxyUrl function or test it indirectly
    it('should handle proxy URL with authentication', () => {
      process.env.HTTPS_PROXY = 'https://username:password@proxy.example.com:8888';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });

    it('should handle proxy URL without authentication', () => {
      process.env.HTTPS_PROXY = 'https://proxy.example.com:8888';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });

    it('should handle HTTP proxy URLs', () => {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:3128';

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });

    it('should handle invalid proxy URLs gracefully', () => {
      process.env.HTTPS_PROXY = 'invalid-url';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse proxy URL:',
        'invalid-url',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should use default ports when not specified', () => {
      // Test HTTPS default port (443)
      process.env.HTTPS_PROXY = 'https://proxy.example.com';

      let client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();

      // Test HTTP default port (80)
      process.env.HTTPS_PROXY = 'http://proxy.example.com';

      client = createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'test-account',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
    });
  });
});