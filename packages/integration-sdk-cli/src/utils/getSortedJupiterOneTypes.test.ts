import {
  RelationshipClass,
  RelationshipDirection,
  Step,
} from '@jupiterone/integration-sdk-core';
import { collectGraphObjectMetadataFromSteps } from './getSortedJupiterOneTypes';

function createIntegrationStep(
  stepNumber: number,
  entityTypes: string[],
  relationshipTypes: string[],
  mappedRelationshipTypes?: string[],
): Step<any> {
  return {
    id: `step-${stepNumber}`,
    name: `Step ${stepNumber}`,
    entities: entityTypes.map((type) => {
      return {
        resourceName: `${type} - ${stepNumber}`,
        _class: [],
        _type: type,
      };
    }),
    relationships: relationshipTypes.map((type) => {
      return {
        sourceType: `${stepNumber}`,
        targetType: `${stepNumber}`,
        _type: type,
        _class: RelationshipClass.HAS,
      };
    }),
    mappedRelationships: mappedRelationshipTypes?.map((type) => {
      return {
        sourceType: `${stepNumber}`,
        targetType: `${stepNumber}`,
        _type: type,
        _class: RelationshipClass.HAS,
        direction: RelationshipDirection.FORWARD,
      };
    }),
    executionHandler: () => undefined,
  };
}

describe('collectGraphObjectMetadataFromSteps', () => {
  test('should return unique entity types', () => {
    const metadata = collectGraphObjectMetadataFromSteps([
      createIntegrationStep(1, ['entity_a'], []),
      createIntegrationStep(2, ['entity_a'], []),
    ]);
    expect(metadata.entities).toEqual([
      {
        resourceName: 'entity_a - 1',
        _class: [],
        _type: 'entity_a',
      },
    ]);
  });

  test('should return all entity types if duplicateTypes is `true`', () => {
    const metadata = collectGraphObjectMetadataFromSteps(
      [
        createIntegrationStep(1, ['entity_a'], []),
        createIntegrationStep(2, ['entity_a'], []),
      ],
      true,
    );
    expect(metadata.entities).toEqual([
      {
        resourceName: 'entity_a - 1',
        _class: [],
        _type: 'entity_a',
      },
      {
        resourceName: 'entity_a - 2',
        _class: [],
        _type: 'entity_a',
      },
    ]);
  });

  test('should return unique relationship types', () => {
    const metadata = collectGraphObjectMetadataFromSteps([
      createIntegrationStep(1, [], ['relationship_a']),
      createIntegrationStep(2, [], ['relationship_a', 'relationship_b']),
    ]);
    expect(metadata.relationships).toEqual([
      {
        sourceType: '1',
        targetType: '1',
        _type: 'relationship_a',
        _class: RelationshipClass.HAS,
      },
      {
        sourceType: '2',
        targetType: '2',
        _type: 'relationship_b',
        _class: RelationshipClass.HAS,
      },
    ]);
  });

  test('should return all relationship types if duplicateTypes is `true`', () => {
    const metadata = collectGraphObjectMetadataFromSteps(
      [
        createIntegrationStep(1, [], ['relationship_a']),
        createIntegrationStep(2, [], ['relationship_a', 'relationship_b']),
      ],
      true,
    );
    expect(metadata.relationships).toEqual([
      {
        sourceType: '1',
        targetType: '1',
        _type: 'relationship_a',
        _class: RelationshipClass.HAS,
      },
      {
        sourceType: '2',
        targetType: '2',
        _type: 'relationship_a',
        _class: RelationshipClass.HAS,
      },
      {
        sourceType: '2',
        targetType: '2',
        _type: 'relationship_b',
        _class: RelationshipClass.HAS,
      },
    ]);
  });

  test('should return unique mapped relationship types', () => {
    const metadata = collectGraphObjectMetadataFromSteps([
      createIntegrationStep(1, [], [], ['mapped_relationship_a']),
      createIntegrationStep(
        2,
        [],
        [],
        ['mapped_relationship_a', 'mapped_relationship_b'],
      ),
    ]);
    expect(metadata.mappedRelationships).toEqual([
      {
        sourceType: '1',
        targetType: '1',
        _type: 'mapped_relationship_a',
        _class: RelationshipClass.HAS,
        direction: RelationshipDirection.FORWARD,
      },
      {
        sourceType: '2',
        targetType: '2',
        _type: 'mapped_relationship_b',
        _class: RelationshipClass.HAS,
        direction: RelationshipDirection.FORWARD,
      },
    ]);
  });

  test('should return all mapped relationship types if duplicateTypes is `true`', () => {
    const metadata = collectGraphObjectMetadataFromSteps(
      [
        createIntegrationStep(1, [], [], ['mapped_relationship_a']),
        createIntegrationStep(
          2,
          [],
          [],
          ['mapped_relationship_a', 'mapped_relationship_b'],
        ),
      ],
      true,
    );
    expect(metadata.mappedRelationships).toEqual([
      {
        sourceType: '1',
        targetType: '1',
        _type: 'mapped_relationship_a',
        _class: RelationshipClass.HAS,
        direction: RelationshipDirection.FORWARD,
      },
      {
        sourceType: '2',
        targetType: '2',
        _type: 'mapped_relationship_a',
        _class: RelationshipClass.HAS,
        direction: RelationshipDirection.FORWARD,
      },
      {
        sourceType: '2',
        targetType: '2',
        _type: 'mapped_relationship_b',
        _class: RelationshipClass.HAS,
        direction: RelationshipDirection.FORWARD,
      },
    ]);
  });
});
