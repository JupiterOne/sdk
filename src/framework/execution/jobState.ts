import { FileSystemGraphObjectStore } from '../storage';
import { Entity, Relationship } from '../types';
import { IntegrationDuplicateKeyError } from './error';
import { IntegrationStep, JobState } from './types';

export class DuplicateKeyTracker {
  private readonly keySet = new Set<string>();

  registerKey(key: string) {
    if (this.keySet.has(key)) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${key})`,
      );
    }

    this.keySet.add(key);
  }
}

export class MemoryDataStore {
  private readonly data = new Map<string, unknown>();

  set(key: string, data: unknown): void {
    this.data[key] = data;
  }

  get(key: string): unknown {
    return this.data[key];
  }
}

export function createStepJobState({
  step,
  duplicateKeyTracker,
  graphObjectStore,
  dataStore,
}: {
  step: IntegrationStep;
  duplicateKeyTracker: DuplicateKeyTracker;
  graphObjectStore: FileSystemGraphObjectStore;
  dataStore: MemoryDataStore;
}): JobState {
  const addEntities = (entities: Entity[]) => {
    entities.forEach((e) => {
      duplicateKeyTracker.registerKey(e._key);
    });

    return graphObjectStore.addEntities(step.id, entities);
  };

  const addRelationships = (relationships: Relationship[]) => {
    relationships.forEach((r) => {
      // relationship types are not playing nicely
      duplicateKeyTracker.registerKey(r._key as string);
    });

    return graphObjectStore.addRelationships(step.id, relationships);
  };

  return {
    setData: async <T>(key: string, data: T): Promise<void> => {
      dataStore.set(key, data);
    },

    getData: async <T>(key: string): Promise<T> => {
      return dataStore.get(key) as T;
    },

    addEntity: (entity: Entity) => {
      return addEntities([entity]);
    },
    addEntities,

    addRelationship: (relationship: Relationship) => {
      return addRelationships([relationship]);
    },
    addRelationships,

    iterateEntities: (filter, iteratee) =>
      graphObjectStore.iterateEntities(filter, iteratee),

    iterateRelationships: (filter, iteratee) =>
      graphObjectStore.iterateRelationships(filter, iteratee),

    flush: () => graphObjectStore.flush(),
  };
}
