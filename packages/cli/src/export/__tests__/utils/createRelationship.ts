import { Entity, createIntegrationRelationship } from "@jupiterone/integration-sdk-core";

interface CreateRelationshipParams {
  _class?: string;
  from: Entity;
  to: Entity
}

export function createRelationship(
  { _class, from, to }: CreateRelationshipParams
) {
  return createIntegrationRelationship({
    _class: _class || 'HAS',
    from,
    to,
  });
};