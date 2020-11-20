import {
  Entity,
  GraphObjectFilter,
  GraphObjectIteratee,
  GraphObjectLookupKey,
  Relationship,
} from '@jupiterone/integration-sdk-core';

/**
 * Persists entities and relationships to a durable medium for the duration of
 * integration execution.
 */
export interface GraphObjectStore {
  addEntities(stepId: string, newEntities: Entity[]): Promise<void>;

  addRelationships(
    stepId: string,
    newRelationships: Relationship[],
  ): Promise<void>;

  getEntity({ _key, _type }: GraphObjectLookupKey): Promise<Entity>;

  iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void>;

  iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void>;

  flush(): Promise<void>;
}

export interface FlushedEntityData {
  entities: Entity[];
}

export interface FlushedRelationshipData {
  relationships: Relationship[];
}

export type FlushedGraphObjectData = FlushedEntityData &
  FlushedRelationshipData;
