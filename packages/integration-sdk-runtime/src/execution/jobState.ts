import {
  Entity,
  JobState,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { GraphObjectStore } from '../storage';
import {
  createDuplicateEntityReport,
  DuplicateEntityReport,
  DuplicateKeyTracker,
} from './duplicateKeyTracker';
import { StepGraphObjectDataUploader } from './uploader';
export type TypeTrackerStepSummary = {
  [key: string]: {
    total: number;
  };
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
    const stepSummary: TypeTrackerStepSummary = {};

    const existingStepSummary = this.graphObjectTypeSummaryByStep.get(stepId);

    for (const [_type, summary] of existingStepSummary?.entries() || []) {
      stepSummary[_type] = {
        ...summary,
      };
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
  /**
   * Hook called before an entity is added to the job state. This function can
   * be used to mutate the entity.
   */
  beforeAddEntity?: (entity: Entity) => Entity;
  /**
   * Hook called before a relationship is added to the job state. This function
   * can be used to mutate the relationship.
   */
  beforeAddRelationship?: (
    relationship: Relationship,
  ) => Promise<Relationship> | Relationship;
  /**
   * Hook called after an entity has been fully added to the job state
   */
  afterAddEntity?: (entity: Entity) => Entity;
  /**
   * Hook called after a relationship has been fully added to the job state
   */
  afterAddRelationship?: (relationship: Relationship) => Relationship;
  /**
   * Hook called after a duplicate entity has been found.
   * @param duplicateEntityReport details about the duplicate entity.
   * @returns void
   */
  onDuplicateEntityKey: (duplicateEntityReport: DuplicateEntityReport) => void;
}

export function createStepJobState({
  stepId,
  duplicateKeyTracker,
  typeTracker,
  graphObjectStore,
  dataStore,
  beforeAddEntity,
  beforeAddRelationship,
  afterAddEntity,
  afterAddRelationship,
  uploader,
  onDuplicateEntityKey,
}: CreateStepJobStateParams): JobState {
  const addEntities = async (entities: Entity[]): Promise<Entity[]> => {
    if (beforeAddEntity) {
      entities = entities.map(beforeAddEntity);
    }

    for (const [index, entity] of entities.entries()) {
      try {
        duplicateKeyTracker.registerKey(entity._key);
      } catch (err) {
        const duplicateEntityReport = await createDuplicateEntityReport({
          duplicateEntity: entity,
          payload: entities,
          indexOfDuplicateKey: index,
          graphObjectStore,
        });
        onDuplicateEntityKey(duplicateEntityReport);
        throw err;
      }

      typeTracker.addStepGraphObjectType({
        stepId,
        _type: entity._type,
        count: 1,
      });
    }

    await graphObjectStore.addEntities(stepId, entities, async (entities) =>
      uploader?.enqueue({
        entities,
        relationships: [],
      }),
    );

    if (afterAddEntity) {
      entities.forEach((e) => afterAddEntity(e));
    }

    return entities;
  };

  function registerRelationshipInTrackers(r: Relationship) {
    duplicateKeyTracker.registerKey(r._key);
    typeTracker.addStepGraphObjectType({
      stepId,
      _type: r._type,
      count: 1,
    });
  }

  const addRelationships = async (relationshipsToAdd: Relationship[]) => {
    let relationships: Relationship[];

    if (beforeAddRelationship) {
      relationships = [];

      for (const relationship of relationshipsToAdd) {
        const newRelationship = await beforeAddRelationship(relationship);
        relationships.push(newRelationship);

        // Avoid iterating the entire set of relationships again later by
        // registering now.
        registerRelationshipInTrackers(newRelationship);
      }
    } else {
      relationships = relationshipsToAdd;
      relationships.forEach(registerRelationshipInTrackers);
    }

    await graphObjectStore.addRelationships(
      stepId,
      relationships,
      async (relationships) =>
        uploader?.enqueue({
          entities: [],
          relationships,
        }),
    );

    if (afterAddRelationship) {
      relationships.forEach((r) => afterAddRelationship(r));
    }
  };

  return {
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
      const unnormalizedKey = duplicateKeyTracker.getGraphObjectMetadata(_key);

      if (!unnormalizedKey) {
        return null;
      }

      return (await graphObjectStore.findEntity(unnormalizedKey)) || null;
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
}
