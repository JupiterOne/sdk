import uniq from 'lodash/uniq';

import {
  IntegrationStep,
  IntegrationInvocationConfig,
  IntegrationExecutionContext,
  IntegrationStepResult,
  IntegrationStepResultStatus,
  IntegrationStepStartStates,
  PartialDatasets,
} from './types';

import { createIntegrationLogger } from './logger';
import { createIntegrationInstanceForLocalExecution } from './instance';

import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';

interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

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
): Promise<ExecuteIntegrationResult> {
  await config.validateInvocation?.(context);

  const stepStates =
    config.getStepStartStates?.(context) ??
    getDefaultStepStartStates(config.integrationSteps);

  const integrationStepResults = await executeSteps(
    context,
    stepStates,
    config.integrationSteps,
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

async function executeSteps(
  context: IntegrationExecutionContext,
  steps: IntegrationStep[],
): Promise<IntegrationStepResult[]> {
  const stepGraph = buildStepDependencyGraph(steps);
  return executeStepDependencyGraph(context, stepGraph);
}

function determinePartialDatasetsFromStepExecutionResults(
  stepResults: IntegrationStepResult[],
): PartialDatasets {
  return stepResults.reduce(
    (partialDatasets: PartialDatasets, stepResult: IntegrationStepResult) => {
      if (stepResult.status !== IntegrationStepResultStatus.SUCCESS) {
        partialDatasets.types = uniq(
          partialDatasets.types.concat(stepResult.types),
        );
      }
      return partialDatasets;
    },
    { types: [] },
  );
}

function getDefaultStepStartStates(
  steps: IntegrationStep[],
): IntegrationStepStartStates {
  return steps.reduce(
    (states: IntegrationStepStartStates, step: IntegrationStep) => {
      states[step.id] = {
        disabled: false,
      };
      return states;
    },
    {},
  );
}
