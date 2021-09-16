import {
  Entity,
  MappedRelationship,
  Relationship,
} from '@jupiterone/integration-sdk-core';

export interface FlushedEntityData {
  entities: Entity[];
}

export interface FlushedRelationshipData {
  relationships: Relationship[];
}

export interface FlushedMappedRelationshipData {
  mappedRelationships: MappedRelationship[];
}

export type FlushedGraphObjectData = FlushedEntityData &
  FlushedRelationshipData &
  FlushedMappedRelationshipData;
