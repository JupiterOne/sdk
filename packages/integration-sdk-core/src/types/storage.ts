import { Entity } from './entity';
import {
  GraphObjectFilter,
  GraphObjectIteratee,
  GraphObjectLookupKey,
} from './jobState';
import { Relationship } from './relationship';

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
