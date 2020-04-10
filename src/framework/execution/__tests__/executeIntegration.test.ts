import {
  IntegrationExecutionContext,
  IntegrationStepResultStatus,
} from '../types';
import { executeIntegrationLocally } from '../executeIntegration';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';

test('executes validator function if provided in config', async () => {
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

test('returns integration step results and metadata about partial datasets', async () => {
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

test('populates partialDatasets type for failed steps', async () => {
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

test('includes types for partially successful steps steps in partial datasets', async () => {
  const validate = jest.fn();

  const result = await executeIntegrationLocally({
    validateInvocation: validate,
    integrationSteps: [
      {
        id: 'my-step-a',
        name: 'My awesome step',
        types: ['test_a'],
        executionHandler: jest
          .fn()
          .mockRejectedValue(new Error('something broke')),
      },
      {
        id: 'my-step-b',
        name: 'My awesome step',
        types: ['test_b'],
        dependsOn: ['my-step-a'],
        executionHandler: jest.fn(),
      },
    ],
  });

  expect(result).toEqual({
    integrationStepResults: [
      {
        id: 'my-step-a',
        name: 'My awesome step',
        types: ['test_a'],
        status: IntegrationStepResultStatus.FAILURE,
      },
      {
        id: 'my-step-b',
        name: 'My awesome step',
        types: ['test_b'],
        dependsOn: ['my-step-a'],
        status:
          IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
      },
    ],
    metadata: {
      partialDatasets: {
        types: ['test_a', 'test_b'],
      },
    },
  });
});
