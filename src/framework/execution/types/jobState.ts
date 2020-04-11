import { Entity, Relationship } from '../../types';

export interface GraphObjectFilter {
  _type: string;
}

export type GraphObjectIteratee<T> = (obj: T) => void | Promise<void>;

export interface JobState {
  addEntities: (entities: Entity[]) => Promise<void>;
  addRelationships: (relationships: Relationship[]) => Promise<void>;

  iterateEntities: (
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Entity>,
  ) => Promise<void>;

  iterateRelationships: (
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<Relationship>,
  ) => Promise<void>;

  flush: () => Promise<void>;
}
