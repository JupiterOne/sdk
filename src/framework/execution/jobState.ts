import { JobState, IntegrationStep } from './types';

import { FileSystemGraphObjectStore } from '../storage';

export function createStepJobState(
  step: IntegrationStep,
  graphObjectStore: FileSystemGraphObjectStore,
): JobState {
  return {
    addEntities: (entities) => graphObjectStore.addEntities(step.id, entities),

    addRelationships: (entities) =>
      graphObjectStore.addRelationships(step.id, entities),

    iterateEntities: (filter, iteratee) =>
      graphObjectStore.iterateEntities(filter, iteratee),

    iterateRelationships: (filter, iteratee) =>
      graphObjectStore.iterateRelationships(filter, iteratee),

    flush: () => graphObjectStore.flush(),
  };
}
