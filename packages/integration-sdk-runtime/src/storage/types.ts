import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

export interface FlushedEntityData {
  entities: Entity[];
}

export interface FlushedRelationshipData {
  relationships: Relationship[];
}

export type FlushedGraphObjectData = FlushedEntityData &
  FlushedRelationshipData;
