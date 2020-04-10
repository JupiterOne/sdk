import { IntegrationStep, IntegrationStepStartStates } from './types';

import {
  IntegrationStepStartStateUnknownStepIdsError,
  IntegrationUnaccountedStepStartStatesError,
} from './error';

export function validateStepStartStates(
  steps: IntegrationStep[],
  stepStartStates: IntegrationStepStartStates,
) {
  const stepSet = new Set<string>(steps.map((step) => step.id));

  const unknownStepIds: string[] = [];

  Object.keys(stepStartStates).forEach((stepId) => {
    if (!stepSet.has(stepId)) {
      unknownStepIds.push(stepId);
    }

    stepSet.delete(stepId);
  });

  if (unknownStepIds.length) {
    const unknownStepIdsString = unknownStepIds
      .map((stepId) => `"${stepId}"`)
      .join(', ');

    throw new IntegrationStepStartStateUnknownStepIdsError(
      `Unknown steps found in start states: ${unknownStepIdsString}`,
    );
  }

  if (stepSet.size > 0) {
    const unaccountedStepIdsString = [...stepSet]
      .map((stepId) => `"${stepId}"`)
      .join(', ');

    throw new IntegrationUnaccountedStepStartStatesError(
      `Start states not found for: ${unaccountedStepIdsString}`,
    );
  }
}
