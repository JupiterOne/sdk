import { Step, StepType } from './types';

export function determineTypeOfStep(step: Step): string {
  if (step.parentAssociation) return StepType.FETCH_CHILD_ENTITIES;
  if (!step.parentAssociation) {
    if (step.response?.responseType === 'SINGLETON') return StepType.SINGLETON;
    return StepType.FETCH_ENTITIES;
  }
  return StepType.BUILD_RELATIONSHIPS;
}
