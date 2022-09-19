import { ExecuteIntegrationResult } from '../executeIntegration';
import { IntegrationStepResult } from '@jupiterone/integration-sdk-core';

type StepIteratee = (
  step: IntegrationStepResult,
  undeclaredTypes: string[],
) => void;

/**
 * Determines which step results have undeclared types,
 * passing the diff results to the provided stepIteratee.
 * @param results
 * @param stepIteratee
 */
export function processDeclaredTypesDiff(
  results: ExecuteIntegrationResult,
  stepIteratee: StepIteratee,
) {
  results.integrationStepResults.forEach((step) => {
    const { declaredTypes, encounteredTypes } = step;

    const declaredTypeSet = new Set(declaredTypes);
    const undeclaredTypes = encounteredTypes.filter(
      (type) => !declaredTypeSet.has(type),
    );

    stepIteratee(step, undeclaredTypes);
  });
}
