import {
  IntegrationInvocationConfig,
  IntegrationInvocationEvent,
  IntegrationExecutionContext,
} from './types';

import { fetchIntegrationInstance } from './instance';

/**
 * Executes an integration based and performs actions based on the
 * event that was provided.
 */
export async function executeIntegration(
  config: IntegrationInvocationConfig,
  event: IntegrationInvocationEvent,
) {
  const instance = await fetchIntegrationInstance(
    config,
    event.integrationInstanceId,
  );

  const context: IntegrationExecutionContext = {
    instance,
  };

  await config.invocationValidator?.(context);
}
