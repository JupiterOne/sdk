import { JobState, Entity, Relationship } from '../framework';
import { DuplicateKeyTracker } from '../framework/execution/jobState';

export interface CreateMockJobStateOptions {
  entities?: Entity[];
  relationships?: Relationship[];
}

/**
 * For convenience, the mock job state allows for
 * easier access to all collected data
 */
export interface MockJobState extends JobState {
  collectedEntities: Entity[];
  collectedRelationships: Relationship[];
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
}: CreateMockJobStateOptions = {}): MockJobState {
  let collectedEntities: Entity[] = [];
  let collectedRelationships: Relationship[] = [];

  const duplicateKeyTracker = new DuplicateKeyTracker();

  return {
    get collectedEntities() {
      return collectedEntities;
    },

    get collectedRelationships() {
      return collectedRelationships;
    },

    addEntities: async (newEntities) => {
      newEntities.forEach((e) => duplicateKeyTracker.registerKey(e._key));
      collectedEntities = collectedEntities.concat(newEntities);
    },

    addRelationships: async (newRelationships) => {
      newRelationships.forEach((r) =>
        duplicateKeyTracker.registerKey(r._key as string),
      );
      collectedRelationships = collectedRelationships.concat(newRelationships);
    },

    iterateEntities: async (filter, iteratee) => {
      const filteredEntities = [...inputEntities, ...collectedEntities].filter(
        (e) => e._type === filter._type,
      );
      for (const entity of filteredEntities) {
        await iteratee(entity);
      }
    },

    iterateRelationships: async (filter, iteratee) => {
      const filteredRelationships = [
        ...inputRelationships,
        ...collectedRelationships,
      ].filter((r) => r._type === filter._type);
      for (const relationship of filteredRelationships) {
        await iteratee(relationship);
      }
    },

    flush: (): Promise<void> => Promise.resolve(),
  };
}
