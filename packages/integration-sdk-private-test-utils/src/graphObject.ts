import { Entity, ExplicitRelationship } from '@jupiterone/integration-sdk-core';
import { times } from 'lodash';
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

/**
 * Create `n` test entities
 *
 * @param n {number} Number of test entities to create
 * @returns {Entity[]}
 */
export function createTestEntities(n: number): Entity[] {
  return times(n, (i) =>
    createTestEntity({
      _key: `entityKey:${i}`,
    }),
  );
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
