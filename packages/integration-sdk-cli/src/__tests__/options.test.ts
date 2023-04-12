import { createCommand } from 'commander';
import {
  addApiClientOptionsToCommand,
  addSyncOptionsToCommand,
  ApiClientOptions,
  getApiClientOptions,
  SyncOptions,
  validateApiClientOptions,
  validateSyncOptions,
} from '../commands/options';
import {
  DEFAULT_UPLOAD_BATCH_SIZE,
  JUPITERONE_DEV_API_BASE_URL,
  JUPITERONE_PROD_API_BASE_URL,
} from '@jupiterone/integration-sdk-runtime';

const syncOptions = (values?: Partial<SyncOptions>): SyncOptions => ({
  source: 'integration-managed',
  uploadBatchSize: DEFAULT_UPLOAD_BATCH_SIZE,
  uploadRelationshipBatchSize: DEFAULT_UPLOAD_BATCH_SIZE,
  skipFinalize: false,
  ...values,
});

const apiClientOptions = (
  values?: Partial<ApiClientOptions>,
): ApiClientOptions => ({
  apiBaseUrl: JUPITERONE_PROD_API_BASE_URL,
  development: false,
  ...values,
});

describe('addSyncOptionsToCommand', () => {
  test('default values', () => {
    expect(
      addSyncOptionsToCommand(createCommand())
        .parse(['node', 'command'])
        .opts<SyncOptions>(),
    ).toEqual(syncOptions());
  });

  test('--integrationInstanceId', () => {
    expect(
      addSyncOptionsToCommand(createCommand())
        .parse(['node', 'command', '--integrationInstanceId', 'test'])
        .opts(),
    ).toEqual(syncOptions({ integrationInstanceId: 'test' }));
  });

  test('--source', () => {
    expect(
      addSyncOptionsToCommand(createCommand())
        .parse(['node', 'command', '--source', 'api'])
        .opts(),
    ).toEqual(syncOptions({ source: 'api' }));
  });

  test('--source unknown', () => {
    expect(() => {
      addSyncOptionsToCommand(createCommand())
        .parse(['node', 'command', '--source', 'unknown'])
        .opts();
    }).toThrowError(/must be/);
  });
});

describe('validateSyncOptions', () => {
  test('valid', () => {
    expect(() =>
      validateSyncOptions(syncOptions({ integrationInstanceId: 'test' })),
    ).not.toThrow();
  });

  test('source: api and integrationInstanceId', () => {
    expect(() =>
      validateSyncOptions(
        syncOptions({ integrationInstanceId: 'test', source: 'api' }),
      ),
    ).toThrowError(/both --source api and --integrationInstanceId/);
  });

  test('source: api without scope', () => {
    expect(() =>
      validateSyncOptions(syncOptions({ source: 'api' })),
    ).toThrowError(/--source api requires --scope/);
  });

  test('defaults with no integrationInstanceId', () => {
    expect(() => validateSyncOptions(syncOptions())).toThrowError(
      /--integrationInstanceId or --source api/,
    );
  });
});

describe('addApiClientOptionsToCommand', () => {
  test('default values', () => {
    // if a developer has these set it could interfere with the test
    delete process.env.JUPITERONE_ACCOUNT;
    delete process.env.JUPITERONE_API_KEY;

    expect(
      addApiClientOptionsToCommand(createCommand())
        .parse(['node', 'command'])
        .opts<SyncOptions>(),
    ).toEqual(apiClientOptions());
  });

  test('--development with default --api-base-url', () => {
    // if a developer has these set it could interfere with the test
    delete process.env.JUPITERONE_ACCOUNT;
    delete process.env.JUPITERONE_API_KEY;

    expect(
      addApiClientOptionsToCommand(createCommand())
        .parse(['node', 'command', '--development'])
        .opts(),
    ).toEqual(
      apiClientOptions({
        development: true,
        apiBaseUrl: JUPITERONE_PROD_API_BASE_URL,
      }),
    );
  });
});

describe('validApiClientOptions', () => {
  test('valid', () => {
    expect(() => validateApiClientOptions(apiClientOptions())).not.toThrow();
  });

  test('--development with default --api-base-url', () => {
    expect(() =>
      validateApiClientOptions(
        apiClientOptions({
          development: true,
          apiBaseUrl: JUPITERONE_PROD_API_BASE_URL,
        }),
      ),
    ).not.toThrow();
  });

  test('--development with --api-base-url JUPITERONE_DEV_API_BASE_URL', () => {
    expect(() =>
      validateApiClientOptions(
        apiClientOptions({
          development: true,
          apiBaseUrl: JUPITERONE_DEV_API_BASE_URL,
        }),
      ),
    ).not.toThrow();
  });

  test('--development with --api-base-url', () => {
    expect(() =>
      validateApiClientOptions(
        apiClientOptions({
          development: true,
          apiBaseUrl: 'https://example.com',
        }),
      ),
    ).toThrow(/both --development and --api-base-url/);
  });
});

describe('getApiClientOptions', () => {
  beforeEach(() => {
    process.env.JUPITERONE_ACCOUNT = 'test account';
    process.env.JUPITERONE_API_KEY = 'test api key';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_ACCOUNT;
    delete process.env.JUPITERONE_API_KEY;
  });

  test('defaults with valid environment', () => {
    expect(getApiClientOptions(apiClientOptions())).toEqual({
      apiBaseUrl: JUPITERONE_PROD_API_BASE_URL,
      accessToken: 'test api key',
      account: 'test account',
    });
  });

  test('defaults with no JUPITERONE_API_KEY', () => {
    delete process.env.JUPITERONE_API_KEY;
    expect(() => getApiClientOptions(apiClientOptions())).toThrowError(
      /JUPITERONE_API_KEY/,
    );
  });

  test('defaults with no JUPITERONE_ACCOUNT', () => {
    delete process.env.JUPITERONE_ACCOUNT;
    expect(() => getApiClientOptions(apiClientOptions())).toThrowError(
      /JUPITERONE_ACCOUNT/,
    );
  });

  test('--development', () => {
    expect(
      getApiClientOptions(apiClientOptions({ development: true })),
    ).toEqual({
      apiBaseUrl: JUPITERONE_DEV_API_BASE_URL,
      accessToken: 'test api key',
      account: 'test account',
    });
  });

  test(`--api-base-url ${JUPITERONE_DEV_API_BASE_URL}`, () => {
    expect(
      getApiClientOptions(
        apiClientOptions({ apiBaseUrl: JUPITERONE_DEV_API_BASE_URL }),
      ),
    ).toEqual({
      apiBaseUrl: JUPITERONE_DEV_API_BASE_URL,
      accessToken: 'test api key',
      account: 'test account',
    });
  });

  test(`--api-base-url ${JUPITERONE_PROD_API_BASE_URL}`, () => {
    expect(
      getApiClientOptions(
        apiClientOptions({ apiBaseUrl: JUPITERONE_PROD_API_BASE_URL }),
      ),
    ).toEqual({
      apiBaseUrl: JUPITERONE_PROD_API_BASE_URL,
      accessToken: 'test api key',
      account: 'test account',
    });
  });
});
