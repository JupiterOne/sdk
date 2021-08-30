import { Step } from "@jupiterone/integration-sdk-core";

export const DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER = '__defaultDependencyGraph';

export function seperateStepsByDependencyGraph<T extends Step<any>[]>(
  integrationSteps: T,
): { [k: string]: T } {
  return integrationSteps.reduce((stepsByGraphId, step) => {
    const graphId =
      step.dependencyGraphId ?? DEFAULT_DEPENDENCY_GRAPH_IDENTIFIER;
    stepsByGraphId[graphId]?.push
      ? stepsByGraphId[graphId].push(step)
      : (stepsByGraphId[graphId] = [step]);
    return stepsByGraphId;
  }, {});
}