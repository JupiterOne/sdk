import {
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';
import { getDeclaredTypesInStep } from './dependencyGraph';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const executionHandler = () => {};

describe('getDeclaredTypesInStep', () => {
  test('should get entity types', () => {
    expect(
      getDeclaredTypesInStep({
        id: 'id',
        name: 'name',
        entities: [
          {
            resourceName: 'entity',
            _type: 'entity',
            _class: 'Entity',
          },
        ],
        relationships: [],
        executionHandler,
      }),
    ).toEqual({ declaredTypes: ['entity'], partialTypes: [] });
  });

  test('should get relationship types', () => {
    expect(
      getDeclaredTypesInStep({
        id: 'id',
        name: 'name',
        entities: [],
        relationships: [
          {
            _type: 'relationship',
            sourceType: 'source_type',
            _class: RelationshipClass.HAS,
            targetType: 'target_type',
          },
        ],
        executionHandler,
      }),
    ).toEqual({ declaredTypes: ['relationship'], partialTypes: [] });
  });

  test('should get mapped relationship types', () => {
    expect(
      getDeclaredTypesInStep({
        id: 'id',
        name: 'name',
        entities: [],
        relationships: [],
        mappedRelationships: [
          {
            _type: 'mapped_relationship',
            sourceType: 'source_type',
            _class: RelationshipClass.HAS,
            targetType: 'target_type',
            direction: RelationshipDirection.FORWARD,
          },
        ],
        executionHandler,
      }),
    ).toEqual({ declaredTypes: ['mapped_relationship'], partialTypes: [] });
  });

  test('should get partial types', () => {
    expect(
      getDeclaredTypesInStep({
        id: 'id',
        name: 'name',
        entities: [
          {
            resourceName: 'entity',
            _type: 'entity',
            _class: 'Entity',
            partial: true,
          },
        ],
        relationships: [],
        executionHandler,
      }),
    ).toEqual({ declaredTypes: ['entity'], partialTypes: ['entity'] });
  });
});
