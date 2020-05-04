import { removeStorageDirectory, writeJsonToPath } from '../../fileSystem';
import { createIntegrationInstanceForLocalExecution } from './instance';
import { createIntegrationLogger } from './logger';
import {
  determinePartialDatasetsFromStepExecutionResults,
  executeSteps,
  getDefaultStepStartStates,
} from './step';
import {
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInvocationConfig,
  IntegrationLogger,
  IntegrationStepResult,
  PartialDatasets,
} from './types';

export interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

/**
 * Starts execution of an integration instance generated from local environment
 * variables.
 */
export function executeIntegrationLocally(config: IntegrationInvocationConfig) {
  return executeIntegrationInstance(
    createIntegrationLogger({
      name: 'Local',
      invocationConfig: config,
      pretty: true,
    }),
    createIntegrationInstanceForLocalExecution(config),
    config,
  );
}

/**
 * Starts execution of an integration instance.
 */
export async function executeIntegrationInstance(
  logger: IntegrationLogger,
  instance: IntegrationInstance,
  config: IntegrationInvocationConfig,
): Promise<ExecuteIntegrationResult> {
  const result = await executeIntegration(
    {
      instance,
      logger,
    },
    config,
  );

  await logger.flush();

  return result;
}

/**
 * Executes an integration and performs actions defined by the config
 * using context that was provided.
 */
async function executeIntegration(
  context: IntegrationExecutionContext,
  config: IntegrationInvocationConfig,
): Promise<ExecuteIntegrationResult> {
  await removeStorageDirectory();

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

  const summary = {
    integrationStepResults,
    metadata: {
      partialDatasets,
    },
  };

  await writeJsonToPath({
    path: 'summary.json',
    data: summary,
  });

  return summary;
}
