import { IntegrationExecutionConfig } from '@jupiterone/integration-sdk-core';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import { StepTestConfig } from './config';
import {
  createMockStepExecutionContext,
  MockIntegrationStepExecutionContext,
} from './context';
import { getStepExecutionOrder } from './getStepExecutionOrder';

export async function executeStepWithDependencies(params: StepTestConfig) {
  const {
    stepId,
    invocationConfig,
    instanceConfig,
    dependencyStepIds,
    onBeforeExecuteStep,
    onAfterExecuteStep,
  } = params;

  const stepDependencyGraph = buildStepDependencyGraph(
    invocationConfig.integrationSteps,
  );

  const step = stepDependencyGraph.getNodeData(stepId);

  if (step.dependencyGraphId && !dependencyStepIds) {
    throw new Error(
      `stepId: "${stepId}" has dependencyGraphId: "${step.dependencyGraphId}" but dependencyStepIds is undefined.`,
    );
  }

  // Only separate steps by dependencyGraphId if the step has a dependencyGraphId
  // and the dependencyGraphOrder is defined
  const useDependencyGraphOrder =
    !!step.dependencyGraphId && !!invocationConfig.dependencyGraphOrder;

  // Get the execution order of the dependencyStepIds
  const dependencySteps = useDependencyGraphOrder
    ? getStepExecutionOrder({
        integrationSteps: invocationConfig.integrationSteps,
        dependencyStepIds: dependencyStepIds!,
        dependencyGraphOrder: invocationConfig.dependencyGraphOrder!,
      })
    : new Set<string>();

  // Add the dependencies of the stepId
  stepDependencyGraph
    .dependenciesOf(stepId)
    .forEach((stepId) => dependencySteps.add(stepId));

  const executionConfig = invocationConfig.loadExecutionConfig
    ? invocationConfig.loadExecutionConfig({ config: instanceConfig })
    : {};
  const preContext: MockIntegrationStepExecutionContext & {
    executionConfig: IntegrationExecutionConfig;
  } = {
    ...createMockStepExecutionContext({ instanceConfig }),
    executionConfig,
  };

  for (const dependencyStepId of dependencySteps) {
    const dependencyStep = stepDependencyGraph.getNodeData(dependencyStepId);
    onBeforeExecuteStep?.(dependencyStep);
    await dependencyStep.executionHandler(preContext);
    onAfterExecuteStep?.(dependencyStep);
  }

  const context: MockIntegrationStepExecutionContext & {
    executionConfig: IntegrationExecutionConfig;
  } = {
    ...createMockStepExecutionContext({
      instanceConfig,
      entities: preContext.jobState.collectedEntities,
      relationships: preContext.jobState.collectedRelationships,
      setData: preContext.jobState.collectedData,
    }),
    executionConfig,
  };

  onBeforeExecuteStep?.(step);
  await step.executionHandler(context);
  onAfterExecuteStep?.(step);

  return {
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    collectedData: context.jobState.collectedData,
    encounteredTypes: context.jobState.encounteredTypes,
    encounteredEntityKeys: new Set<string>([
      ...context.jobState.collectedEntities.map((e) => e._key),
      ...preContext.jobState.collectedEntities.map((e) => e._key),
    ]),
  };
}
