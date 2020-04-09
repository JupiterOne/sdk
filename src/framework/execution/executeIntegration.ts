import {
  IntegrationInvocationConfig,
  IntegrationExecutionContext,
} from './types';

import { createIntegrationInstanceForLocalExecution } from './instance';

/**
 * Starts local execution of an integration
 */
export function executeIntegrationLocally(config: IntegrationInvocationConfig) {
  const instance = createIntegrationInstanceForLocalExecution(config);
  const context: IntegrationExecutionContext = { instance };

  return executeIntegration(context, config);
}

/**
 * Executes an integration based and performs actions based on the
 * event that was provided.
 */
async function executeIntegration(
  context: IntegrationExecutionContext,
  config: IntegrationInvocationConfig,
) {
  await config.invocationValidator?.(context);
}
