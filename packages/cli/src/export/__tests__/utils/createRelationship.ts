import {
  Entity,
  createDirectRelationship
} from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

interface CreateRelationshipParams {
  _class?: RelationshipClass;
  from: Entity;
  to: Entity;
}

export function createRelationship({
  _class,
  from,
  to,
}: CreateRelationshipParams) {
  return createDirectRelationship({
    _class: _class || RelationshipClass.HAS,
    from,
    to,
  });
}
