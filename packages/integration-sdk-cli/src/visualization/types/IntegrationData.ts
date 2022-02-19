import {
  Entity,
  ExplicitRelationship,
  MappedRelationship,
} from '@jupiterone/integration-sdk-core';

export interface IntegrationData {
  entities: Entity[];
  relationships: ExplicitRelationship[];
  mappedRelationships: MappedRelationship[];
}
