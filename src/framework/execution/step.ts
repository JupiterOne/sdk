import uniq from 'lodash/uniq';

import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';

import {
  IntegrationStep,
  IntegrationExecutionContext,
  IntegrationStepResult,
  IntegrationStepResultStatus,
  IntegrationStepStartStates,
  PartialDatasets,
} from './types';

export async function executeSteps(
  context: IntegrationExecutionContext,
  steps: IntegrationStep[],
  stepStartStates: IntegrationStepStartStates,
): Promise<IntegrationStepResult[]> {
  const stepGraph = buildStepDependencyGraph(steps);
  return executeStepDependencyGraph(context, stepGraph, stepStartStates);
}

export function getDefaultStepStartStates(
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

export function determinePartialDatasetsFromStepExecutionResults(
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
