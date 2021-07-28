import {
  Entity,
  JobState,
  Relationship,
  KeyNormalizationFunction,
} from '@jupiterone/integration-sdk-core';
import {
  DuplicateKeyTracker,
  MemoryDataStore,
  TypeTracker,
} from '@jupiterone/integration-sdk-runtime';
import { v4 as uuid } from 'uuid';

export interface CreateMockJobStateOptions {
  entities?: Entity[];
  relationships?: Relationship[];
  setData?: { [key: string]: any };
  normalizeGraphObjectKey?: KeyNormalizationFunction;
}

/**
 * For convenience, the mock job state allows for
 * easier access to all collected data
 */
export interface MockJobState extends JobState {
  collectedEntities: Entity[];
  collectedRelationships: Relationship[];
  encounteredTypes: string[];
}

/**
 * Creates an in memory version of a jobState object.
 *
 * An initial set of entities and relationships
 * to be optionally be provided for testing dependent steps
 * that require iterating over a previously pulled in set of
 * entities.
 */
export function createMockJobState({
  entities: inputEntities = [],
  relationships: inputRelationships = [],
  setData: inputData = {},
  normalizeGraphObjectKey,
}: CreateMockJobStateOptions = {}): MockJobState {
  let collectedEntities: Entity[] = [];
  let collectedRelationships: Relationship[] = [];

  const duplicateKeyTracker = new DuplicateKeyTracker(normalizeGraphObjectKey);
  const typeTracker = new TypeTracker();
  const dataStore = new MemoryDataStore();
  const mockStepId = `mock-step-${uuid()}`;

  inputEntities.forEach((e) => {
    duplicateKeyTracker.registerKey(e._key, {
      _type: e._type,
      _key: e._key,
    });

    typeTracker.addStepGraphObjectType({
      stepId: mockStepId,
      _type: e._type,
      count: 1,
    });
  });

  inputRelationships.forEach((r) => {
    duplicateKeyTracker.registerKey(r._key as string, {
      _type: r._type,
      _key: r._key,
    });

    typeTracker.addStepGraphObjectType({
      stepId: mockStepId,
      _type: r._type,
      count: 1,
    });
  });

  Object.keys(inputData).forEach((key) => dataStore.set(key, inputData[key]));

  const addEntities = async (newEntities: Entity[]): Promise<Entity[]> => {
    newEntities.forEach((e) => {
      duplicateKeyTracker.registerKey(e._key, {
        _type: e._type,
        _key: e._key,
      });

      typeTracker.addStepGraphObjectType({
        stepId: mockStepId,
        _type: e._type,
        count: 1,
      });
    });

    collectedEntities = collectedEntities.concat(newEntities);
    return Promise.resolve(newEntities);
  };

  const addRelationships = async (newRelationships: Relationship[]) => {
    newRelationships.forEach((r) => {
      duplicateKeyTracker.registerKey(r._key as string, {
        _type: r._type,
        _key: r._key,
      });

      typeTracker.addStepGraphObjectType({
        stepId: mockStepId,
        _type: r._type,
        count: 1,
      });
    });

    collectedRelationships = collectedRelationships.concat(newRelationships);
    return Promise.resolve();
  };

  const iterateEntities = async <T extends Entity = Entity>(
    filter,
    iteratee,
  ) => {
    const filteredEntities = [...inputEntities, ...collectedEntities].filter(
      (e) => e._type === filter._type,
    );
    for (const entity of filteredEntities as T[]) {
      await iteratee(entity);
    }
  };

  return {
    get collectedEntities() {
      return collectedEntities;
    },

    get collectedRelationships() {
      return collectedRelationships;
    },

    get encounteredTypes() {
      return typeTracker.getAllEncounteredTypes();
    },

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
      await addEntities([entity]);
      return entity;
    },
    addEntities,

    addRelationship: async (relationship: Relationship) => {
      await addRelationships([relationship]);
    },
    addRelationships,

    findEntity: async (_key: string) => {
      const graphObjectMetadata = duplicateKeyTracker.getGraphObjectMetadata(
        _key,
      );

      if (!graphObjectMetadata) {
        return null;
      }

      return Promise.resolve(
        [...inputEntities, ...collectedEntities].find(
          (e) => e._key === graphObjectMetadata._key,
        ) || null,
      );
    },

    hasKey: (_key: string) => {
      return duplicateKeyTracker.hasKey(_key);
    },

    iterateEntities,

    iterateRelationships: async <T extends Relationship = Relationship>(
      filter,
      iteratee,
    ) => {
      const filteredRelationships = [
        ...inputRelationships,
        ...collectedRelationships,
      ].filter((r) => r._type === filter._type);
      for (const relationship of filteredRelationships as T[]) {
        await iteratee(relationship);
      }
    },

    flush: (): Promise<void> => Promise.resolve(),
  };
}
