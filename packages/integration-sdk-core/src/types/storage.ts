import { Entity } from './entity';
import {
  GraphObjectFilter,
  GraphObjectIteratee,
  GraphObjectLookupKey,
} from './jobState';
import { Relationship } from './relationship';
import { GraphObjectIndexMetadata } from '../types/step';

export interface GetIndexMetadataForGraphObjectTypeParams {
  stepId: string;
  _type: string;
  graphObjectCollectionType: 'entities' | 'relationships';
}

/**
 * Persists entities and relationships to a durable medium for the duration of
 * integration execution.
 */
export interface GraphObjectStore {
  addEntities(
    stepId: string,
    newEntities: Entity[],
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
  ): Promise<void>;

  addRelationships(
    stepId: string,
    newRelationships: Relationship[],
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
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

  flush(
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
    stepId?: string,
  ): Promise<void>;

  getIndexMetadataForGraphObjectType?: (
    params: GetIndexMetadataForGraphObjectTypeParams,
  ) => GraphObjectIndexMetadata | undefined;
}
