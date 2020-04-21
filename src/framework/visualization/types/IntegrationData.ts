import { Entity, Relationship, ExplicitRelationship } from '../../types';

export interface IntegrationData {
  entities: Entity[];
  relationships: ExplicitRelationship[];
}
