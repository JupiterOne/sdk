import {
  createIntegrationInstanceForLocalExecution,
  LOCAL_INTEGRATION_INSTANCE,
} from '../instance';
import { randomUUID as uuid } from 'crypto';

describe('createIntegrationInstanceForLocalExecution', () => {
  beforeEach(() => {
    process.env.MY_FIELD = 'test';
    delete process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID;
    delete process.env.DISABLED_INGESTION_SOURCES;
  });

  afterEach(() => {
    delete process.env.MY_FIELD;
    delete process.env.DISABLED_INGESTION_SOURCES;
  });

  test('creates local integration instance with config loaded from env if no instance id is provided', () => {
    const instance = createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
    });

    expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
  });

  test('should allow specifying local JupiterOne account id through environment variable', () => {
    const accountId =
      (process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID = uuid());

    const instance = createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
    });

    expect(instance).toEqual({
      ...LOCAL_INTEGRATION_INSTANCE,
      accountId,
    });
  });

  test('should load config from env onto instance', () => {
    const instance = createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
      instanceConfigFields: {
        myField: {
          type: 'string',
        },
      },
    });

    expect(instance).toEqual({
      ...LOCAL_INTEGRATION_INSTANCE,
      config: {
        myField: 'test',
      },
    });
  });

  describe('DISABLED_INGESTION_SOURCES', () => {
    test('should not set disabledSources when env var is not set', () => {
      const instance = createIntegrationInstanceForLocalExecution({
        validateInvocation: jest.fn(),
        integrationSteps: [],
      });

      expect(instance.disabledSources).toBeUndefined();
    });

    test('should parse single ingestion source from env var', () => {
      process.env.DISABLED_INGESTION_SOURCES = 'permissions';

      const instance = createIntegrationInstanceForLocalExecution({
        validateInvocation: jest.fn(),
        integrationSteps: [],
      });

      expect(instance.disabledSources).toEqual([
        { ingestionSourceId: 'permissions' },
      ]);
    });

    test('should parse multiple comma-separated ingestion sources from env var', () => {
      process.env.DISABLED_INGESTION_SOURCES =
        'permissions,vulnerabilities,commits';

      const instance = createIntegrationInstanceForLocalExecution({
        validateInvocation: jest.fn(),
        integrationSteps: [],
      });

      expect(instance.disabledSources).toEqual([
        { ingestionSourceId: 'permissions' },
        { ingestionSourceId: 'vulnerabilities' },
        { ingestionSourceId: 'commits' },
      ]);
    });

    test('should trim whitespace from ingestion source IDs', () => {
      process.env.DISABLED_INGESTION_SOURCES =
        ' permissions , vulnerabilities , commits ';

      const instance = createIntegrationInstanceForLocalExecution({
        validateInvocation: jest.fn(),
        integrationSteps: [],
      });

      expect(instance.disabledSources).toEqual([
        { ingestionSourceId: 'permissions' },
        { ingestionSourceId: 'vulnerabilities' },
        { ingestionSourceId: 'commits' },
      ]);
    });

    test('should return undefined for empty string', () => {
      process.env.DISABLED_INGESTION_SOURCES = '';

      const instance = createIntegrationInstanceForLocalExecution({
        validateInvocation: jest.fn(),
        integrationSteps: [],
      });

      expect(instance.disabledSources).toBeUndefined();
    });

    test('should filter out empty entries from comma-separated list', () => {
      process.env.DISABLED_INGESTION_SOURCES = 'permissions,,vulnerabilities,';

      const instance = createIntegrationInstanceForLocalExecution({
        validateInvocation: jest.fn(),
        integrationSteps: [],
      });

      expect(instance.disabledSources).toEqual([
        { ingestionSourceId: 'permissions' },
        { ingestionSourceId: 'vulnerabilities' },
      ]);
    });
  });
});
