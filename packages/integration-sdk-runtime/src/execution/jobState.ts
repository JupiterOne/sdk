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

export type TypeTrackerStepSummary = {
  graphObjectTypeSummary: {
    _type: string;
    total: number;
  }[];
};

type InternalTypeTrackerSummary = {
  total: number;
};

export class TypeTracker {
  private readonly graphObjectTypeSummaryByStep = new Map<
    string,
    Map<string, InternalTypeTrackerSummary>
  >();

  addStepGraphObjectType(input: {
    stepId: string;
    _type: string;
    count: number;
  }) {
    const existingStepSummary = this.graphObjectTypeSummaryByStep.get(
      input.stepId,
    );

    if (existingStepSummary) {
      const existingTypeMap = existingStepSummary.get(input._type);

      if (existingTypeMap) {
        existingTypeMap.total += input.count;
      } else {
        existingStepSummary.set(input._type, { total: input.count });
      }
    } else {
      this.graphObjectTypeSummaryByStep.set(
        input.stepId,
        new Map<string, InternalTypeTrackerSummary>([
          [input._type, { total: input.count }],
        ]),
      );
    }
  }

  getEncounteredTypesForStep(stepId: string): string[] {
    const existingStepSummary = this.graphObjectTypeSummaryByStep.get(stepId);
    return existingStepSummary ? [...existingStepSummary.keys()] : [];
  }

  getAllEncounteredTypes(): string[] {
    const encounteredTypes = new Set<string>();

    for (const stepSummary of this.graphObjectTypeSummaryByStep.values()) {
      for (const _type of stepSummary.keys()) {
        encounteredTypes.add(_type);
      }
    }

    return [...encounteredTypes];
  }

  summarizeStep(stepId: string): TypeTrackerStepSummary {
    const stepSummary: TypeTrackerStepSummary = {
      graphObjectTypeSummary: [],
    };

    const existingStepSummary = this.graphObjectTypeSummaryByStep.get(stepId);

    for (const [_type, summary] of existingStepSummary?.entries() || []) {
      stepSummary.graphObjectTypeSummary.push({
        _type,
        ...summary,
      });
    }

    return stepSummary;
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

  delete(key: string): void {
    delete this.data[key];
  }
}

export interface CreateStepJobStateParams {
  stepId: string;
  duplicateKeyTracker: DuplicateKeyTracker;
  typeTracker: TypeTracker;
  graphObjectStore: GraphObjectStore;
  dataStore: MemoryDataStore;
  uploader?: StepGraphObjectDataUploader;
  beforeAddEntity?: (
    entity: Entity,
    jobState: JobState,
  ) => Entity | Promise<Entity>;
}

export function createStepJobState({
  stepId,
  duplicateKeyTracker,
  typeTracker,
  graphObjectStore,
  dataStore,
  beforeAddEntity,
  uploader,
}: CreateStepJobStateParams): JobState {
  const addEntities = async (entities: Entity[]): Promise<Entity[]> => {
    if (beforeAddEntity) {
      entities = await Promise.all(
        entities.map((e) => beforeAddEntity(e, jobState)),
      );
    }

    entities.forEach((e) => {
      duplicateKeyTracker.registerKey(e._key, {
        _type: e._type,
        _key: e._key,
      });

      typeTracker.addStepGraphObjectType({
        stepId,
        _type: e._type,
        count: 1,
      });
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
      duplicateKeyTracker.registerKey(r._key, {
        _type: r._type,
        _key: r._key,
      });

      typeTracker.addStepGraphObjectType({
        stepId,
        _type: r._type,
        count: 1,
      });
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

  const jobState = {
    setData: async <T>(key: string, data: T): Promise<void> => {
      dataStore.set(key, data);
      return Promise.resolve();
    },

    getData: async <T>(key: string): Promise<T | undefined> => {
      return Promise.resolve(dataStore.get(key) as T);
    },

    deleteData: async <T>(key: string): Promise<void> => {
      dataStore.delete(key);
      return Promise.resolve();
    },

    addEntity: async (entity: Entity): Promise<Entity> => {
      const newEntity = await addEntities([entity]);
      return newEntity[0];
    },
    addEntities,

    addRelationship: (relationship: Relationship) => {
      return addRelationships([relationship]);
    },
    addRelationships,

    findEntity: async (_key: string | undefined) => {
      if (!_key) return null;
      const graphObjectMetadata = duplicateKeyTracker.getGraphObjectMetadata(
        _key,
      );

      if (!graphObjectMetadata) {
        return null;
      }

      return (
        (await graphObjectStore.findEntity(graphObjectMetadata._key)) || null
      );
    },

    hasKey: (_key: string | undefined) => {
      if (!_key) return false;
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

  return jobState;
}
