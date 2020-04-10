import {
  IntegrationExecutionContext,
  IntegrationStepResultStatus,
} from '../types';
import { executeIntegrationLocally } from '../executeIntegration';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';

test('should execute validator function if provided in config', async () => {
  const validate = jest.fn();

  await executeIntegrationLocally({
    validateInvocation: validate,
    integrationSteps: [],
  });

  const expectedContext: IntegrationExecutionContext = {
    instance: LOCAL_INTEGRATION_INSTANCE,
    logger: expect.any(jest.requireActual('bunyan')),
  };

  expect(validate).toHaveBeenCalledWith(expectedContext);
});

test('should return integration step results and metadata about partial datasets', async () => {
  const validate = jest.fn();

  const result = await executeIntegrationLocally({
    validateInvocation: validate,
    integrationSteps: [
      {
        id: 'my-step',
        name: 'My awesome step',
        types: ['test'],
        executionHandler: jest.fn(),
      },
    ],
  });

  expect(result).toEqual({
    integrationStepResults: [
      {
        id: 'my-step',
        name: 'My awesome step',
        types: ['test'],
        status: IntegrationStepResultStatus.SUCCESS,
      },
    ],
    metadata: {
      partialDatasets: {
        types: [],
      },
    },
  });
});

test('should populate partialDatasets type for failed steps', async () => {
  const validate = jest.fn();

  const result = await executeIntegrationLocally({
    validateInvocation: validate,
    integrationSteps: [
      {
        id: 'my-step',
        name: 'My awesome step',
        types: ['test'],
        executionHandler: jest
          .fn()
          .mockRejectedValue(new Error('something broke')),
      },
    ],
  });

  expect(result).toEqual({
    integrationStepResults: [
      {
        id: 'my-step',
        name: 'My awesome step',
        types: ['test'],
        status: IntegrationStepResultStatus.FAILURE,
      },
    ],
    metadata: {
      partialDatasets: {
        types: ['test'],
      },
    },
  });
});
