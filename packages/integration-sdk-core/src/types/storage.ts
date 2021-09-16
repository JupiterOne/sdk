import { Entity } from './entity';
import { GraphObjectFilter, GraphObjectIteratee } from './jobState';
import { MappedRelationship, Relationship } from './relationship';
import { GraphObjectIndexMetadata } from '../types/step';

export type CollectionType =
  | 'entities'
  | 'relationships'
  | 'mappedRelationships';

export interface GetIndexMetadataForGraphObjectTypeParams {
  stepId: string;
  _type: string;
  graphObjectCollectionType: CollectionType;
}

/**
 * Persists entities, relationships, and mapped relationships to a durable medium for the duration of
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

  addMappedRelationships(
    stepId: string,
    newMappedRelationships: MappedRelationship[],
    onRelationshipsFlushed?: (
      mappedRelationships: MappedRelationship[],
    ) => Promise<void>,
  ): Promise<void>;

  findEntity(_key: string | undefined): Promise<Entity | undefined>;

  iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void>;

  iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void>;

  // TODO iterateMappedRelationships()

  flush(
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
    onMappedRelationshipsFlushed?: (
      mappedRelationships: MappedRelationship[],
    ) => Promise<void>,
  ): Promise<void>;

  getIndexMetadataForGraphObjectType?: (
    params: GetIndexMetadataForGraphObjectTypeParams,
  ) => GraphObjectIndexMetadata | undefined;
}
