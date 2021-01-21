import {
  Entity,
  IntegrationDuplicateKeyError,
  JobState,
  KeyNormalizationFunction,
  Relationship,
} from '@jupiterone/integration-sdk-core';

import { GraphObjectStore } from '../storage';
import { StepGraphObjectDataUploader } from './uploader';
import { BigMap } from './utils/bigMap';

export interface DuplicateKeyTrackerGraphObjectMetadata {
  _type: string;
  _key: string;
}

const DUPLICATE_KEY_TRACKER_DEFAULT_MAP_KEY_SPACE = 2000000;

/**
 * Contains a map of every graph object key to a specific set of metadata about
 * the graph object used for filtering. For example, we use the `_type` property
 * on graph objects as a method of filtering data down when iterating entities
 * or relationships. We store the `_type` inside the metadata for a fast lookup
 * table.
 */
export class DuplicateKeyTracker {
  private readonly graphObjectKeyMap: BigMap<
    string,
    DuplicateKeyTrackerGraphObjectMetadata
  >;
  private readonly normalizationFunction: KeyNormalizationFunction;

  constructor(normalizationFunction?: KeyNormalizationFunction) {
    this.normalizationFunction = normalizationFunction || ((_key) => _key);

    this.graphObjectKeyMap = new BigMap<
      string,
      DuplicateKeyTrackerGraphObjectMetadata
    >(DUPLICATE_KEY_TRACKER_DEFAULT_MAP_KEY_SPACE);
  }

  registerKey(_key: string, metadata: DuplicateKeyTrackerGraphObjectMetadata) {
    const normalizedKey = this.normalizationFunction(_key);
    if (this.graphObjectKeyMap.has(normalizedKey)) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${_key})`,
      );
    }

    this.graphObjectKeyMap.set(normalizedKey, metadata);
  }

  getGraphObjectMetadata(_key: string) {
    return this.graphObjectKeyMap.get(this.normalizationFunction(_key));
  }

  hasKey(_key: string) {
    return this.graphObjectKeyMap.has(this.normalizationFunction(_key));
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
  graphObjectStore: GraphObjectStore;
  dataStore: MemoryDataStore;
  uploader?: StepGraphObjectDataUploader;
}

export function createStepJobState({
  stepId,
  duplicateKeyTracker,
  typeTracker,
  graphObjectStore,
  dataStore,
  uploader,
}: CreateStepJobStateParams): JobState {
  const addEntities = async (entities: Entity[]): Promise<Entity[]> => {
    entities.forEach((e) => {
      duplicateKeyTracker.registerKey(e._key, {
        _type: e._type,
        _key: e._key,
      });

      typeTracker.registerType(e._type);
    });

    await graphObjectStore.addEntities(stepId, entities, async (entities) =>
      uploader?.enqueue({
        entities,
        relationships: [],
      }),
    );
    return entities;
  };

  const addRelationships = (relationships: Relationship[]) => {
    relationships.forEach((r) => {
      // relationship types are not playing nicely
      duplicateKeyTracker.registerKey(r._key as string, {
        _type: r._type,
        _key: r._key,
      });
      typeTracker.registerType(r._type as string);
    });

    return graphObjectStore.addRelationships(
      stepId,
      relationships,
      async (relationships) =>
        uploader?.enqueue({
          entities: [],
          relationships,
        }),
    );
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

    findEntity: async (_key: string) => {
      const graphObjectMetadata = duplicateKeyTracker.getGraphObjectMetadata(
        _key,
      );

      if (!graphObjectMetadata) {
        return null;
      }

      const entity = await graphObjectStore.getEntity({
        _key: graphObjectMetadata._key,
        _type: graphObjectMetadata._type,
      });

      return entity;
    },

    hasKey: (_key: string) => {
      return duplicateKeyTracker.hasKey(_key);
    },

    iterateEntities: (filter, iteratee) =>
      graphObjectStore.iterateEntities(filter, iteratee),

    iterateRelationships: (filter, iteratee) =>
      graphObjectStore.iterateRelationships(filter, iteratee),

    flush: () =>
      graphObjectStore.flush(
        async (entities) =>
          uploader?.enqueue({
            entities,
            relationships: [],
          }),
        async (relationships) =>
          uploader?.enqueue({
            entities: [],
            relationships,
          }),
      ),

    async waitUntilUploadsComplete() {
      await uploader?.waitUntilUploadsComplete();
    },
  };
}
