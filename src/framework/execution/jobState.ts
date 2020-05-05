import { JobState, IntegrationStep } from './types';

import { FileSystemGraphObjectStore } from '../storage';
import { IntegrationDuplicateKeyError } from './error';
import { Entity, Relationship } from '../types';

export class DuplicateKeyTracker {
  keySet = new Set<string>();

  registerKey(key: string) {
    if (this.keySet.has(key)) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${key})`,
      );
    }

    this.keySet.add(key);
  }
}

export function createStepJobState(
  step: IntegrationStep,
  duplicateKeyTracker: DuplicateKeyTracker,
  graphObjectStore: FileSystemGraphObjectStore,
): JobState {
  return {
    addEntities: (entities: Entity[]) => {
      entities.forEach((e) => {
        duplicateKeyTracker.registerKey(e._key);
      });

      return graphObjectStore.addEntities(step.id, entities);
    },

    addRelationships: (relationships: Relationship[]) => {
      relationships.forEach((r) => {
        // relationship types are not playing nicely
        duplicateKeyTracker.registerKey(r._key as string);
      });

      return graphObjectStore.addRelationships(step.id, relationships);
    },

    iterateEntities: (filter, iteratee) =>
      graphObjectStore.iterateEntities(filter, iteratee),

    iterateRelationships: (filter, iteratee) =>
      graphObjectStore.iterateRelationships(filter, iteratee),

    flush: () => graphObjectStore.flush(),
  };
}
