import path from 'path';
import fs from 'fs';

import uniq from 'lodash/uniq';
import { pick } from 'lodash';

import {
  AfterAddEntityHookFunction,
  AfterAddRelationshipHookFunction,
  BeforeAddEntityHookFunction,
  BeforeAddRelationshipHookFunction,
  ExecutionContext,
  IntegrationStepResult,
  InvocationConfig,
  PartialDatasets,
  Step,
  StepExecutionContext,
  StepResultStatus,
  StepStartStates,
  StepExecutionHandlerWrapperFunction,
} from '@jupiterone/integration-sdk-core';

import { GraphObjectStore } from '../storage';
import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from './dependencyGraph';
import { MemoryDataStore } from './jobState';
import { DuplicateKeyTracker } from './duplicateKeyTracker';
import { CreateStepGraphObjectDataUploaderFunction } from './uploader';
import {
  DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER,
  seperateStepsByDependencyGraph,
} from './utils/seperateStepsByDependencyGraph';

export async function executeSteps<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
>({
  executionContext,
  integrationSteps,
  stepStartStates,
  duplicateKeyTracker,
  graphObjectStore,
  dataStore,
  createStepGraphObjectDataUploader,
  beforeAddEntity,
  beforeAddRelationship,
  afterAddEntity,
  afterAddRelationship,
  dependencyGraphOrder,
  stepConcurrency,
  executionHandlerWrapper,
}: {
  executionContext: TExecutionContext;
  integrationSteps: Step<TStepExecutionContext>[];
  stepStartStates: StepStartStates;
  duplicateKeyTracker: DuplicateKeyTracker;
  graphObjectStore: GraphObjectStore;
  dataStore: MemoryDataStore;
  createStepGraphObjectDataUploader?: CreateStepGraphObjectDataUploaderFunction;
  beforeAddEntity?: BeforeAddEntityHookFunction<TExecutionContext>;
  beforeAddRelationship?: BeforeAddRelationshipHookFunction<TExecutionContext>;
  afterAddEntity?: AfterAddEntityHookFunction<TExecutionContext>;
  afterAddRelationship?: AfterAddRelationshipHookFunction<TExecutionContext>;
  dependencyGraphOrder?: string[];
  stepConcurrency?: number;
  executionHandlerWrapper?: StepExecutionHandlerWrapperFunction<TStepExecutionContext>;
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
        'A graphId in the dependencyGraphOrder was not referenced by any steps.',
      );
      continue;
    }

    const stepIds = steps.map((s) => s.id);
    allStepResults = allStepResults.concat(
      await executeStepDependencyGraph({
        executionContext,
        inputGraph: buildStepDependencyGraph(steps),
        stepStartStates: pick(stepStartStates, stepIds),
        stepConcurrency,
        duplicateKeyTracker,
        graphObjectStore,
        dataStore,
        createStepGraphObjectDataUploader,
        beforeAddEntity,
        beforeAddRelationship,
        afterAddEntity,
        afterAddRelationship,
        executionHandlerWrapper,
      }),
    );
  }

  return allStepResults;
}

export function getDefaultStepStartStates<
  TStepExecutionContext extends StepExecutionContext,
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

      if (stepResult.partialTypesToForce) {
        stepPartialDatasets.types.push(...stepResult.partialTypesToForce);
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
  dependenciesCache?: {
    enabled: boolean;
    filepath: string;
  };
}

export function prepareLocalStepCollection<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
>(
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
  { step = [], dependenciesCache }: CollectOptions = {},
) {
  const allStepIds = config.integrationSteps.map((step) => step.id);

  const stepsToRun: string[] = step.filter(
    (step: string | undefined | null) => step !== undefined && step !== null,
  );

  // build out the dependency graph so we can
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

        if (dependenciesCache?.enabled) {
          ctx.logger.info(
            { cacheFilePath: dependenciesCache.filepath },
            `Using dependencies cache.`,
          );
        }

        for (const stepId of allStepIds) {
          const originalValue = originalEnabledRecord[stepId] ?? {};
          if (stepsToRun.includes(stepId)) {
            const stepCachePath = dependenciesCache?.enabled
              ? buildStepCachePath(
                  dependenciesCache.filepath,
                  dependentSteps,
                  stepId,
                )
              : null;

            enabledRecord[stepId] = {
              ...originalValue,
              disabled: false,
              ...(stepCachePath && {
                stepCachePath,
              }),
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

/**
 * Determines if the path to a step cache is valid for the given step.
 * If true, returns the path.
 * If false, returns null.
 * @param rootDirectory
 * @param dependentSteps
 * @param stepId
 */
function buildStepCachePath(
  rootDirectory: string,
  dependentSteps: string[],
  stepId: string,
): string | null {
  if (dependentSteps.includes(stepId)) {
    const stepFilepath = path.resolve(rootDirectory, 'graph', stepId);
    const stepCacheExists = fs.existsSync(stepFilepath);
    return stepCacheExists ? stepFilepath : null;
  }

  return null;
}
