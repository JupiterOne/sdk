import { IntegrationExecutionContext } from '../types';
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
