import { IntegrationStep, IntegrationStepStartStates } from './types';

import {
  IntegrationStepStartStateInvalidStepIdError,
  IntegrationUnaccountedStepStartStatesError,
} from './error';

export function validateStepStartStates(
  steps: IntegrationStep[],
  stepStartStates: IntegrationStepStartStates,
) {
  const stepSet = new Set<string>(steps.map((step) => step.id));

  Object.keys(stepStartStates).forEach((stepId) => {
    if (!stepSet.has(stepId)) {
      throw new IntegrationStepStartStateInvalidStepIdError(
        `Invalid step id "${stepId}" found in start states.`,
      );
    }

    stepSet.delete(stepId);
  });

  if (stepSet.size > 0) {
    const unaccountedStepIds = [...stepSet]
      .map((stepId) => `"${stepId}"`)
      .join(', ');

    throw new IntegrationUnaccountedStepStartStatesError(
      `Steps not defined in start states found: ${unaccountedStepIds}`,
    );
  }
}
