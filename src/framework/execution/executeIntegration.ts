import {
  IntegrationInvocationConfig,
  IntegrationExecutionContext,
  IntegrationStepResult,
  PartialDatasets,
} from './types';

import { createIntegrationLogger } from './logger';
import { createIntegrationInstanceForLocalExecution } from './instance';

import {
  executeSteps,
  getDefaultStepStartStates,
  determinePartialDatasetsFromStepExecutionResults,
} from './step';

export interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

/**
 * Starts local execution of an integration
 */
export function executeIntegrationLocally(config: IntegrationInvocationConfig) {
  const logger = createIntegrationLogger({
    name: 'Local',
    invocationConfig: config,
    pretty: true,
  });

  const instance = createIntegrationInstanceForLocalExecution(config);

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
): Promise<ExecuteIntegrationResult> {
  await config.validateInvocation?.(context);

  const stepStartStates =
    config.getStepStartStates?.(context) ??
    getDefaultStepStartStates(config.integrationSteps);

  const integrationStepResults = await executeSteps(
    context,
    config.integrationSteps,
    stepStartStates,
  );

  const partialDatasets = determinePartialDatasetsFromStepExecutionResults(
    integrationStepResults,
  );

  return {
    integrationStepResults,
    metadata: {
      partialDatasets,
    },
  };
}
