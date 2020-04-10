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
 * Executes an integration and performs actions defined by the config
 * using context that was provided.
 */
async function executeIntegration(
  context: IntegrationExecutionContext,
  config: IntegrationInvocationConfig,
) {
  await config.validateInvocation?.(context);
}
