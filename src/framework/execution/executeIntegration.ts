import {
  IntegrationStep,
  IntegrationInvocationConfig,
  IntegrationExecutionContext,
} from './types';

import { createIntegrationLogger } from './logger';
import { createIntegrationInstanceForLocalExecution } from './instance';

import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';

/**
 * Starts local execution of an integration
 */
export function executeIntegrationLocally(config: IntegrationInvocationConfig) {
  const instance = createIntegrationInstanceForLocalExecution(config);
  const logger = createIntegrationLogger(instance.name, config);
  const context: IntegrationExecutionContext = {
    instance,
    logger,
  };

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
  await executeSteps(context, config.integrationSteps);
}

async function executeSteps(
  context: IntegrationExecutionContext,
  steps: IntegrationStep[],
) {
  const stepGraph = buildStepDependencyGraph(steps);
  return executeStepDependencyGraph(context, stepGraph);
}
