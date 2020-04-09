import {
  fetchIntegrationInstance,
  LOCAL_INTEGRATION_INSTANCE,
} from '../instance';

describe('fetchIntegrationInstance', () => {
  test('creates local integration instance with config loaded from env if no instance id is provided', async () => {
    const instance = await fetchIntegrationInstance({
      invocationValidator: jest.fn(),
      integrationSteps: [],
    });

    expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
  });

  test('throws error when fetching instance by id (not implemented yet)', async () => {
    await expect(
      fetchIntegrationInstance(
        {
          instanceConfigFields: {},
          invocationValidator: jest.fn(),
          integrationSteps: [],
        },
        'test-instance-id',
      ),
    ).rejects.toThrow(/Not implemented yet./);
  });
});
