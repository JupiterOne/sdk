import { IntegrationExecutionConfig } from '@jupiterone/integration-sdk-core';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import { StepTestConfig } from './config';
import {
  createMockStepExecutionContext,
  MockIntegrationStepExecutionContext,
} from './context';

export async function executeStepWithDependencies(params: StepTestConfig) {
  const { stepId, invocationConfig, instanceConfig } = params;

  const stepDependencyGraph = buildStepDependencyGraph(
    invocationConfig.integrationSteps,
  );

  const step = stepDependencyGraph.getNodeData(stepId);
  if (step.dependencyGraphId) {
    throw new Error(
      'executeStepWithDependencies does not currently support steps with a dependencyGraphId',
    );
  }

  const dependencyStepIds = stepDependencyGraph.dependenciesOf(stepId);

  const executionConfig = invocationConfig.loadExecutionConfig
    ? invocationConfig.loadExecutionConfig({ config: instanceConfig })
    : {};
  const preContext: MockIntegrationStepExecutionContext & {
    executionConfig: IntegrationExecutionConfig;
  } = {
    ...createMockStepExecutionContext({ instanceConfig }),
    executionConfig,
  };

  for (const dependencyStepId of dependencyStepIds) {
    const dependencyStep = stepDependencyGraph.getNodeData(dependencyStepId);
    await dependencyStep.executionHandler(preContext);
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

  await step.executionHandler(context);

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
