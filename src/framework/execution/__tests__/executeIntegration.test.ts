import { IntegrationActionName, IntegrationExecutionContext } from '../types';
import { executeIntegration } from '../executeIntegration';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';

test('should execute validator function if provided in config', async () => {
  const validate = jest.fn();

  await executeIntegration(
    {
      invocationValidator: validate,
      integrationSteps: [],
    },
    {
      action: {
        name: IntegrationActionName.INGEST,
      },
    },
  );

  const expectedContext: IntegrationExecutionContext = {
    instance: LOCAL_INTEGRATION_INSTANCE,
  };

  expect(validate).toHaveBeenCalledWith(expectedContext);
});
