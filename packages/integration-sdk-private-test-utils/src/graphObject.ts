import { Entity, ExplicitRelationship } from '@jupiterone/integration-sdk-core';
import { v4 as uuid } from 'uuid';

export function createTestEntity(partial?: Partial<Entity>): Entity {
  return {
    _key: uuid(),
    _class: uuid(),
    _type: uuid(),
    [uuid()]: uuid(),
    ...partial,
  };
}

export function createTestRelationship(
  partial?: Partial<ExplicitRelationship>,
): ExplicitRelationship {
  return {
    _key: uuid(),
    _toEntityKey: uuid(),
    _fromEntityKey: uuid(),
    _class: uuid(),
    _type: uuid(),
    [uuid()]: uuid(),
    ...partial,
  };
}
