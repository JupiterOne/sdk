import { DepGraph } from 'dependency-graph';
import PromiseQueue from 'p-queue';

import { FileSystemGraphObjectStore } from '../storage';
import { createStepJobState } from './jobState';

import {
  IntegrationStep,
  IntegrationStepResult,
  IntegrationStepResultStatus,
  IntegrationStepStartStates,
  IntegrationExecutionContext,
  IntegrationStepExecutionContext,
} from './types';

/**
 * This function accepts a list of steps and constructs a dependency graph
 * using the `dependsOn` field from each step.
 */
export function buildStepDependencyGraph(
  steps: IntegrationStep[],
): DepGraph<IntegrationStep> {
  const dependencyGraph = new DepGraph<IntegrationStep>();

  // add all nodes first
  steps.forEach((step) => {
    dependencyGraph.addNode(step.id, step);
  });

  // add dependencies
  steps.forEach((step) => {
    step.dependsOn?.forEach((dependency) => {
      dependencyGraph.addDependency(step.id, dependency);
    });
  });

  // executing overallOrder will throw an error
  // if a circular dependency is found
  dependencyGraph.overallOrder();

  return dependencyGraph;
}

/**
 * This function takes a step dependency graph and executes
 * the steps in order based on the values of their `dependsOn`.
 *
 * How execution works:
 *
 * First, all leaf nodes are executed.
 *
 * After each node's work completes, the node is removed from
 * the dependency graph. After the node is removed,
 * the graph checks to see if the removal of the node has
 * created more leaf nodes and executes them. This continues
 * until there are no more nodes to execute.
 */
export function executeStepDependencyGraph(
  executionContext: IntegrationExecutionContext,
  inputGraph: DepGraph<IntegrationStep>,
  stepStartStates: IntegrationStepStartStates,
): Promise<IntegrationStepResult[]> {
  // create a clone of the dependencyGraph because mutating
  // the input graph is icky
  //
  // cloned graph is mutated because it is slightly easier to
  // remove nodes from the graph to find new leaf nodes
  // instead of tracking state ourselves
  const workingGraph = inputGraph.clone();

  // create a queue for managing promises to be executed
  const promiseQueue = new PromiseQueue();

  const graphObjectStore = new FileSystemGraphObjectStore();

  const stepResultsMap = buildStepResultsMap(inputGraph, stepStartStates);

  function isStepEnabled(step: IntegrationStep) {
    return stepStartStates[step.id].disabled === false;
  }

  /**
   * Updates the result of a step result with the provided satus
   */
  function updateStepResultStatus(
    step: IntegrationStep,
    status: IntegrationStepResultStatus,
  ) {
    const existingResult = stepResultsMap.get(step.id);
    if (existingResult) {
      stepResultsMap.set(step.id, { ...existingResult, status });
    }
  }

  /**
   * Finds a result from the dependency graph that contains
   * a status of FAILURE or PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE.
   *
   * NOTE: the untouched input graph is used for determining
   * results since the working graph gets mutated.
   */
  function stepHasDependencyFailure(step: IntegrationStep) {
    return inputGraph
      .dependenciesOf(step.id)
      .map((id) => stepResultsMap.get(id))
      .find((result) => {
        const status = result?.status;
        return (
          status === IntegrationStepResultStatus.FAILURE ||
          status ===
            IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE
        );
      });
  }

  /**
   * Safely removes a step from the workingGraph, ensuring
   * that dependencys are removed.
   *
   * This function helps create new leaf nodes to execute.
   */
  function removeStepFromWorkingGraph(step: IntegrationStep) {
    workingGraph.dependantsOf(step.id).forEach((dependent) => {
      workingGraph.removeDependency(dependent, step.id);
    });

    workingGraph.removeNode(step.id);
  }

  /**
   * This function checks if a step's dependencies are complete
   */
  function stepDependenciesAreComplete(step: IntegrationStep) {
    const executingDependencies = inputGraph
      .dependenciesOf(step.id)
      .map((id) => stepResultsMap.get(id))
      .filter(
        (stepResult) =>
          stepResult?.status === IntegrationStepResultStatus.PENDING_EVALUATION,
      );

    return executingDependencies.length === 0;
  }

  return new Promise((resolve, reject) => {
    /**
     * If an unexpected error occurs during the execution of a step,
     * this function catch that, pause the queue so that
     * additional work is not executed and reject the promise.
     */
    function handleUnexpectedError(err) {
      promiseQueue.pause();
      reject(err);
    }

    /**
     * This function finds leaf steps that can be executed
     * and adds the step execution to the promise queue.
     *
     * As prior to enqueuing the work, step is removed from the
     * working graph.
     */
    function enqueueLeafSteps() {
      // do not add more work if promise queue has been paused.
      if (promiseQueue.isPaused) {
        return;
      }

      workingGraph.overallOrder(true).forEach((stepId) => {
        const step = workingGraph.getNodeData(stepId);

        /**
         * We only remove the node from the graph and
         * execute the step if it is enabled.
         *
         * This allows for dependencies to remain in the graph
         * and prevents dependent steps from executing.
         */
        if (isStepEnabled(step) && stepDependenciesAreComplete(step)) {
          removeStepFromWorkingGraph(step);
          promiseQueue.add(() =>
            executeStep(step).catch(handleUnexpectedError),
          );
        }
      });
    }

    /**
     * This function runs a step's executionHandler.
     *
     * Errors from an execution handler are caught and used to
     * determine a status code for the step's result.
     */
    async function executeStep(step: IntegrationStep) {
      const context = buildStepContext(
        executionContext,
        step,
        graphObjectStore,
      );

      context.logger.stepStart(step);

      let status: IntegrationStepResultStatus;

      try {
        await step.executionHandler(context);
        context.logger.stepSuccess(step);

        if (stepHasDependencyFailure(step)) {
          status =
            IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE;
        } else {
          status = IntegrationStepResultStatus.SUCCESS;
        }
      } catch (err) {
        context.logger.stepFailure(step, err);
        status = IntegrationStepResultStatus.FAILURE;
      }

      await context.jobState.flush();
      updateStepResultStatus(step, status);
      enqueueLeafSteps();
    }

    // kick off work for all leaf nodes
    enqueueLeafSteps();

    promiseQueue.onIdle().then(() => resolve([...stepResultsMap.values()]));
  });
}

function buildStepContext(
  context: IntegrationExecutionContext,
  step: IntegrationStep,
  graphObjectStore: FileSystemGraphObjectStore,
): IntegrationStepExecutionContext {
  return {
    ...context,
    logger: context.logger.child({
      step: step.id,
    }),
    jobState: createStepJobState(step, graphObjectStore),
  };
}

function buildStepResultsMap(
  dependencyGraph: DepGraph<IntegrationStep>,
  stepStartStates: IntegrationStepStartStates,
) {
  const stepResultMapEntries = dependencyGraph
    .overallOrder()
    .map(
      (stepId): IntegrationStepResult => {
        const step = dependencyGraph.getNodeData(stepId);

        const hasDisabledDependencies =
          dependencyGraph
            .dependenciesOf(step.id)
            .filter((id) => stepStartStates[id].disabled).length > 0;

        return {
          id: step.id,
          name: step.name,
          types: step.types,
          dependsOn: step.dependsOn,
          status:
            stepStartStates[step.id].disabled || hasDisabledDependencies
              ? IntegrationStepResultStatus.DISABLED
              : IntegrationStepResultStatus.PENDING_EVALUATION,
        };
      },
    )
    .map((result): [string, IntegrationStepResult] => [result.id, result]);

  return new Map<string, IntegrationStepResult>(stepResultMapEntries);
}
