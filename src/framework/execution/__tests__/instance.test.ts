import {
  createIntegrationInstanceForLocalExecution,
  LOCAL_INTEGRATION_INSTANCE,
} from '../instance';

describe('createIntegrationInstanceForLocalExecution', () => {
  beforeEach(() => {
    process.env.MY_FIELD = 'test';
  });

  afterEach(() => {
    delete process.env.MY_FIELD;
  });

  test('creates local integration instance with config loaded from env if no instance id is provided', async () => {
    const instance = await createIntegrationInstanceForLocalExecution({
      validateInvocation: jest.fn(),
      integrationSteps: [],
    });

    expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
  });

  test('should load config from env onto instance', async () => {
    const instance = await createIntegrationInstanceForLocalExecution({
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
});
