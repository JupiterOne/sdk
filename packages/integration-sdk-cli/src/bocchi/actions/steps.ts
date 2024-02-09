import { Step, StepType } from '../utils/types';

export function stepTemplateHelper(step: Step) {
  const stepTemplateData = {
    stepId: step.id,
    stepName: step.name,
    entityName: 'TEST',
    apiCall: true,
    dependsOn: step.dependsOn ?? [],
  };

  let stepTemplateFile: string;
  const typeOfStep = determineTypeOfStep(step);

  switch (typeOfStep) {
    case StepType.SINGLETON:
      stepTemplateFile = 'singleton.ts.hbs';
      break;
    case StepType.FETCH_ENTITIES:
      stepTemplateFile = 'fetch-entities.ts.hbs';
      break;
    case StepType.FETCH_CHILD_ENTITIES:
      stepTemplateFile = 'fetch-child-entities.ts.hbs';
      break;
    default:
      stepTemplateFile = 'build-relationships.ts.hbs';
  }

  return {
    stepTemplateFile,
    stepTemplateData,
  };
}

function determineTypeOfStep(step: Step): string {
  if (step.parentAssociation) return StepType.FETCH_CHILD_ENTITIES;
  if (!step.parentAssociation) {
    if (step.response?.responseType === 'SINGLETON') return StepType.SINGLETON;
    return StepType.FETCH_ENTITIES;
  }
  return StepType.BUILD_RELATIONSHIPS;
}
