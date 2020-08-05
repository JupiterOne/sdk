import {
  IntegrationDuplicateKeyError,
  Entity,
  Relationship,
  JobState,
} from '@jupiterone/integration-sdk-core';

import { FileSystemGraphObjectStore } from '../storage';

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

export class TypeTracker {
  private readonly registeredTypeSet = new Set<string>();

  registerType(type: string) {
    this.registeredTypeSet.add(type);
  }

  getEncounteredTypes() {
    return [...this.registeredTypeSet.values()];
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

export interface CreateStepJobStateParams {
  stepId: string;
  duplicateKeyTracker: DuplicateKeyTracker;
  typeTracker: TypeTracker;
  graphObjectStore: FileSystemGraphObjectStore;
  dataStore: MemoryDataStore;
}

export function createStepJobState({
  stepId,
  duplicateKeyTracker,
  typeTracker,
  graphObjectStore,
  dataStore,
}: CreateStepJobStateParams): JobState {
  const addEntities = async (entities: Entity[]): Promise<Entity[]> => {
    entities.forEach((e) => {
      duplicateKeyTracker.registerKey(e._key);
      typeTracker.registerType(e._type);
    });

    await graphObjectStore.addEntities(stepId, entities);
    return entities;
  };

  const addRelationships = (relationships: Relationship[]) => {
    relationships.forEach((r) => {
      // relationship types are not playing nicely
      duplicateKeyTracker.registerKey(r._key as string);
      typeTracker.registerType(r._type as string);
    });

    return graphObjectStore.addRelationships(stepId, relationships);
  };

  return {
    setData: async <T>(key: string, data: T): Promise<void> => {
      dataStore.set(key, data);
    },

    getData: async <T>(key: string): Promise<T> => {
      return dataStore.get(key) as T;
    },

    addEntity: async (entity: Entity): Promise<Entity> => {
      await addEntities([entity]);
      return entity;
    },
    addEntities,

    addRelationship: (relationship: Relationship) => {
      return addRelationships([relationship]);
    },
    addRelationships,

    getEntity: (lookupKey) => {
      return graphObjectStore.getEntity(lookupKey);
    },

    iterateEntities: (filter, iteratee) =>
      graphObjectStore.iterateEntities(filter, iteratee),

    iterateRelationships: (filter, iteratee) =>
      graphObjectStore.iterateRelationships(filter, iteratee),

    flush: () => graphObjectStore.flush(),
  };
}
