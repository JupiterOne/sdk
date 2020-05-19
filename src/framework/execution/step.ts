import uniq from 'lodash/uniq';

import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';
import {
  ExecutionContext,
  IntegrationStep,
  Step,
  IntegrationStepResult,
  IntegrationStepResultStatus,
  IntegrationExecutionContext,
  StepStartStates,
  PartialDatasets,
} from './types';

export async function executeIntegrationSteps(
  context: IntegrationExecutionContext,
  steps: IntegrationStep[],
  stepStartStates: StepStartStates,
): Promise<IntegrationStepResult[]> {
  const stepGraph = buildStepDependencyGraph(steps);
  return executeStepDependencyGraph(context, stepGraph, stepStartStates);
}

export async function executeSteps(
  context: ExecutionContext,
  steps: Step[],
  stepStartStates: StepStartStates,
): Promise<IntegrationStepResult[]> {
  const stepGraph = buildStepDependencyGraph(steps);
  return executeStepDependencyGraph(context, stepGraph, stepStartStates);
}

export function getDefaultStepStartStates(steps: Step[]): StepStartStates {
  return steps.reduce((states: StepStartStates, step: Step) => {
    states[step.id] = {
      disabled: false,
    };
    return states;
  }, {});
}

export function determinePartialDatasetsFromStepExecutionResults(
  stepResults: IntegrationStepResult[],
): PartialDatasets {
  return stepResults.reduce(
    (partialDatasets: PartialDatasets, stepResult: IntegrationStepResult) => {
      if (
        stepResult.status === IntegrationStepResultStatus.FAILURE ||
        stepResult.status ===
          IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE
      ) {
        partialDatasets.types = uniq(
          partialDatasets.types.concat(stepResult.types),
        );
      }
      return partialDatasets;
    },
    { types: [] },
  );
}
