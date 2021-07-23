import uniq from 'lodash/uniq';
import { pick } from 'lodash';

import {
  BeforeAddEntityHookFunction,
  ExecutionContext,
  IntegrationStepResult,
  InvocationConfig,
  PartialDatasets,
  Step,
  StepExecutionContext,
  StepResultStatus,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { GraphObjectStore } from '../storage';
import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';
import { DuplicateKeyTracker, MemoryDataStore } from './jobState';
import { CreateStepGraphObjectDataUploaderFunction } from './uploader';
import {
  DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER,
  seperateStepsByDependencyGraph,
} from './utils/seperateStepsByDependencyGraph';

export async function executeSteps<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>({
  executionContext,
  integrationSteps,
  stepStartStates,
  duplicateKeyTracker,
  graphObjectStore,
  dataStore,
  createStepGraphObjectDataUploader,
  beforeAddEntity,
  dependencyGraphOrder,
}: {
  executionContext: TExecutionContext;
  integrationSteps: Step<TStepExecutionContext>[];
  stepStartStates: StepStartStates;
  duplicateKeyTracker: DuplicateKeyTracker;
  graphObjectStore: GraphObjectStore;
  dataStore: MemoryDataStore;
  createStepGraphObjectDataUploader?: CreateStepGraphObjectDataUploaderFunction;
  beforeAddEntity?: BeforeAddEntityHookFunction<TExecutionContext>;
  dependencyGraphOrder?: string[];
}): Promise<IntegrationStepResult[]> {
  const stepsByGraphId = seperateStepsByDependencyGraph(integrationSteps);
  let allStepResults: IntegrationStepResult[] = [];

  for (const graphId of [
    DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER,
    ...(dependencyGraphOrder ?? []),
  ]) {
    const steps = stepsByGraphId[graphId];

    if (!steps) {
      executionContext.logger.warn(
        { graphId },
        'A graphId in the dependencyGraphOrder was not refrenced by any steps.',
      );
      continue;
    }

    const stepIds = steps.map((s) => s.id);
    allStepResults = allStepResults.concat(
      await executeStepDependencyGraph({
        executionContext,
        inputGraph: buildStepDependencyGraph(steps),
        stepStartStates: pick(stepStartStates, stepIds),
        duplicateKeyTracker,
        graphObjectStore,
        dataStore,
        createStepGraphObjectDataUploader,
        beforeAddEntity,
      }),
    );
  }

  return allStepResults;
}

export function getDefaultStepStartStates<
  TStepExecutionContext extends StepExecutionContext
>(steps: Step<TStepExecutionContext>[]): StepStartStates {
  return steps.reduce(
    (states: StepStartStates, step: Step<TStepExecutionContext>) => {
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
      const stepPartialDatasets: PartialDatasets = {
        types: [],
      };

      if (stepResult.status !== StepResultStatus.DISABLED) {
        stepPartialDatasets.types.push(...stepResult.partialTypes);
      }

      if (
        stepResult.status === StepResultStatus.FAILURE ||
        stepResult.status ===
          StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE
      ) {
        stepPartialDatasets.types.push(...stepResult.declaredTypes);
      }

      return {
        types: uniq(partialDatasets.types.concat(stepPartialDatasets.types)),
      };
    },
    { types: [] },
  );
}

export interface CollectOptions {
  step?: string[];
}

export function prepareLocalStepCollection<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
>(
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
  { step = [] }: CollectOptions = {},
) {
  const allStepIds = config.integrationSteps.map((step) => step.id);

  const stepsToRun: string[] = step.filter(
    (step: string | undefined | null) => step !== undefined && step !== null,
  );

  // build out the dependecy graph so we can
  // enable the dependencies of the steps
  // we want to run.
  const depGraph = buildStepDependencyGraph(config.integrationSteps);
  const dependentSteps: string[] = [];
  for (const step of stepsToRun) {
    const dependencies = depGraph.dependenciesOf(step);
    dependentSteps.push(...dependencies);
  }

  stepsToRun.push(...dependentSteps);
  const originalGetStepStartStates = config.getStepStartStates;

  config.getStepStartStates = stepsToRun.length
    ? async (ctx) => {
        const originalEnabledRecord = await (originalGetStepStartStates?.(
          ctx,
        ) ?? {});
        const enabledRecord: StepStartStates = {};
        for (const stepId of allStepIds) {
          const originalValue = originalEnabledRecord[stepId] ?? {};
          if (stepsToRun.includes(stepId)) {
            enabledRecord[stepId] = {
              ...originalValue,
              disabled: false,
            };
          } else {
            enabledRecord[stepId] = {
              ...originalValue,
              disabled: true,
            };
          }
        }
        return enabledRecord;
      }
    : originalGetStepStartStates &&
      (async (ctx) => Promise.resolve(originalGetStepStartStates(ctx)));

  return config;
}
