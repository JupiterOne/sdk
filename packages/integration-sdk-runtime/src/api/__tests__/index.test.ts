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
