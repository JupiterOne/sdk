import {
  Entity,
  JobState,
  Relationship,
  IntegrationMissingKeyError,
  IntegrationDuplicateKeyError,
  GraphObjectLookupKey,
  KeyNormalizationFunction,
} from '@jupiterone/integration-sdk-core';
import {
  DuplicateKeyTracker,
  MemoryDataStore,
  TypeTracker,
} from '@jupiterone/integration-sdk-runtime';

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

  inputEntities.forEach((e) => {
    duplicateKeyTracker.registerKey(e._key, {
      _type: e._type,
      _key: e._key,
    });
    typeTracker.registerType(e._type);
  });
  inputRelationships.forEach((r) => {
    duplicateKeyTracker.registerKey(r._key as string, {
      _type: r._type,
      _key: r._key,
    });
    typeTracker.registerType(r._type as string);
  });

  Object.keys(inputData).forEach((key) => dataStore.set(key, inputData[key]));

  const addEntities = async (newEntities: Entity[]): Promise<Entity[]> => {
    newEntities.forEach((e) => {
      duplicateKeyTracker.registerKey(e._key, {
        _type: e._type,
        _key: e._key,
      });
      typeTracker.registerType(e._type);
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
      typeTracker.registerType(r._type as string);
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

  const getEntity = async (lookupKey: GraphObjectLookupKey) => {
    const { _key, _type } = lookupKey;
    const entities: Entity[] = [];

    await iterateEntities({ _type }, async (e) => {
      if (e._key === _key) {
        entities.push(e);
      }

      return Promise.resolve();
    });

    if (entities.length === 0) {
      throw new IntegrationMissingKeyError(
        `Failed to find entity (_type=${_type}, _key=${_key})`,
      );
    } else if (entities.length > 1) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_type=${_type}, _key=${_key})`,
      );
    } else {
      return entities[0];
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
      return typeTracker.getEncounteredTypes();
    },

    setData: async <T>(key: string, data: T): Promise<void> => {
      dataStore.set(key, data);
      return Promise.resolve();
    },

    getData: async <T>(key: string): Promise<T | undefined> => {
      return Promise.resolve(dataStore.get(key) as T);
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

      const entity = await getEntity({
        _key: graphObjectMetadata._key,
        _type: graphObjectMetadata._type,
      });

      return entity;
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

    flush: (stepId?: string): Promise<void> => Promise.resolve(),
  };
}
