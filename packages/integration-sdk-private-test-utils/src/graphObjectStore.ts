import {
  Entity,
  GraphObjectFilter,
  GraphObjectIteratee,
  Relationship,
  GraphObjectStore,
} from '@jupiterone/integration-sdk-core';

/**
 * Custom implementation of GraphObjectStore that stores all entities and
 * relationships in memory. This should never be used in production and is
 * currently only used for testing purposes.
 */
export class InMemoryGraphObjectStore implements GraphObjectStore {
  private readonly entityMap = new Map<string, Entity>();
  private readonly relationshipMap = new Map<string, Relationship>();

  async addEntities(stepId: string, newEntities: Entity[]): Promise<void> {
    for (const entity of newEntities) {
      this.entityMap.set(entity._key, entity);
    }

    return Promise.resolve();
  }

  async addRelationships(
    stepId: string,
    newRelationships: Relationship[],
  ): Promise<void> {
    for (const relationship of newRelationships) {
      this.relationshipMap.set(relationship._key, relationship);
    }

    return Promise.resolve();
  }

  async findEntity(_key: string): Promise<Entity | undefined> {
    const entity = this.entityMap.get(_key);

    return Promise.resolve(entity);
  }

  async iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void> {
    for (const [_, entity] of this.entityMap) {
      if (entity._type === filter._type) {
        await iteratee(entity as T);
      }
    }
  }

  async iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void> {
    for (const [_, relationship] of this.relationshipMap) {
      if (relationship._type === filter._type) {
        await iteratee(relationship as T);
      }
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }
}
