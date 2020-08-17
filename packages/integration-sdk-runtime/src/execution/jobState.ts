import {
  IntegrationDuplicateKeyError,
  Entity,
  Relationship,
  JobState,
} from '@jupiterone/integration-sdk-core';

import { FileSystemGraphObjectStore } from '../storage';

export interface DuplicateKeyTrackerGraphObjectMetadata {
  _type: string;
}

/**
 * Contains a map of every graph object key to a specific set of metadata about
 * the graph object used for filtering. For example, we use the `_type` property
 * on graph objects as a method of filtering data down when interating entities
 * or relationships. We store the `_type` inside the metadata for a fast lookup
 * table.
 */
export class DuplicateKeyTracker {
  private readonly graphObjectKeyMap = new Map<
    string,
    DuplicateKeyTrackerGraphObjectMetadata
  >();

  registerKey(_key: string, metadata: DuplicateKeyTrackerGraphObjectMetadata) {
    if (this.graphObjectKeyMap.has(_key)) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${_key})`,
      );
    }

    this.graphObjectKeyMap.set(_key, metadata);
  }

  getGraphObjectMetadata(_key: string) {
    return this.graphObjectKeyMap.get(_key);
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
      typeTracker.registerType(e._type);
    });

    await graphObjectStore.addEntities(stepId, entities);
    return entities;
  };

  const addRelationships = (relationships: Relationship[]) => {
    relationships.forEach((r) => {
      // relationship types are not playing nicely
      duplicateKeyTracker.registerKey(r._key as string, {
        _type: r._type,
      });
      typeTracker.registerType(r._type as string);
    });

    return graphObjectStore.addRelationships(stepId, relationships);
  };

  return {
    setData: async <T>(key: string, data: T): Promise<void> => {
      dataStore.set(key, data);
      return Promise.resolve();
    },

    getData: async <T>(key: string): Promise<T> => {
      return Promise.resolve(dataStore.get(key) as T);
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
