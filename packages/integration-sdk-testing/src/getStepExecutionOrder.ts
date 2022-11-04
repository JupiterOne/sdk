import { Step } from '@jupiterone/integration-sdk-core';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import {
  DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER,
  seperateStepsByDependencyGraph,
} from '@jupiterone/integration-sdk-runtime/src/execution/utils/seperateStepsByDependencyGraph';

export function getStepExecutionOrder(params: {
  integrationSteps: Step<any>[];
  dependencyStepIds: string[];
  dependencyGraphOrder: string[];
}): Set<string> {
  const { integrationSteps, dependencyGraphOrder, dependencyStepIds } = params;
  const stepDependencyGraph = buildStepDependencyGraph(integrationSteps);
  const stepsByDependencyGraph =
    seperateStepsByDependencyGraph(integrationSteps);

  // Filter the stepIds by only the ones we wish to run
  for (const dependencyGraph in stepsByDependencyGraph) {
    stepsByDependencyGraph[dependencyGraph] = stepsByDependencyGraph[
      dependencyGraph
    ].filter((step) => dependencyStepIds?.includes(step.id));
  }

  // Gets the set of all dependency steps
  const dependencySteps = new Set<string>();
  for (const dependencyGraphId of [
    DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER,
    ...dependencyGraphOrder,
  ]) {
    for (const step of stepsByDependencyGraph[dependencyGraphId] || []) {
      stepDependencyGraph
        .dependenciesOf(step.id)
        .forEach((id) => dependencySteps.add(id));
      dependencySteps.add(step.id);
    }
  }

  return dependencySteps;
}
