import { Step, StepType } from '../utils/types';

export function stepTemplateHelper(step: Step) {
  return {
    stepTemplateFile: `${determineTypeOfStep(step)}.ts.hbs`,
  };
}

function determineTypeOfStep(step: Step): string {
  return step.response.responseType === 'SINGLETON'
    ? step.parentAssociation
      ? StepType.CHILD_SINGLETON
      : StepType.SINGLETON
    : step.parentAssociation
    ? StepType.FETCH_CHILD_ENTITIES
    : StepType.FETCH_ENTITIES;
}
