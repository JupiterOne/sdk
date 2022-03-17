import { mocked } from 'ts-jest/utils';
import Alpha from '@lifeomic/alpha';

import {
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  createApiClient,
  getAccountFromEnvironment,
} from '../index';
import { IntegrationMaxTimeoutBadValueError } from '../error';

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
  afterEach(() => {
    delete process.env.SDK_API_CLIENT_MAX_TIMEOUT;
  });

  test('successfully creates apiClient', () => {
    process.env.SDK_API_CLIENT_MAX_TIMEOUT = '20000';

    const apiBaseUrl = getApiBaseUrl();

    const client = createApiClient({
      apiBaseUrl,
      account: 'test-account',
      accessToken: 'test-key',
    });

    expect(client).toBeInstanceOf(AlphaMock);

    expect(AlphaMock).toHaveReturnedTimes(1);
    expect(AlphaMock).toHaveBeenCalledWith({
      baseURL: apiBaseUrl,
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
        'LifeOmic-Account': 'test-account',
      },
      retry: {
        maxTimeout: 20000,
      },
    });
  });

  test('bad SDK_API_CLIENT_MAX_TIMEOUT throws error', () => {
    process.env.SDK_API_CLIENT_MAX_TIMEOUT = '10000x';
    const apiBaseUrl = getApiBaseUrl();
    try {
      createApiClient({
        apiBaseUrl,
        account: 'test-account',
        accessToken: 'test-key',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrationMaxTimeoutBadValueError);
      expect(err.message).toBe(
        'The SDK_API_CLIENT_MAX_TIMEOUT environment variable is not a number',
      );
    }
  });
});
