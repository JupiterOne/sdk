import { IntegrationExecutionConfig } from '@jupiterone/integration-sdk-core';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import { StepTestConfigWithCredentials } from './config';
import {
  createMockStepExecutionContext,
  MockIntegrationStepExecutionContext,
} from './context';

export async function executeStepWithDependencies(
  params: StepTestConfigWithCredentials,
) {
  const { stepId, invocationConfig, instanceConfig } = params;

  if (invocationConfig.dependencyGraphOrder) {
    throw new Error(
      'executeStepWithDependencies does not currently support dependencyGraphOrder',
    );
  }

  const stepDependencyGraph = buildStepDependencyGraph(
    invocationConfig.integrationSteps,
  );

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

  const { executionHandler } = stepDependencyGraph.getNodeData(stepId);
  await executionHandler(context);

  return {
    collectedEntities: context.jobState.collectedEntities,
    collectedRelationships: context.jobState.collectedRelationships,
    collectedData: context.jobState.collectedData,
    encounteredTypes: context.jobState.encounteredTypes,
  };
}
