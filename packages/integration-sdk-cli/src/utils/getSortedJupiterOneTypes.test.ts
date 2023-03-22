import {
  RelationshipClass,
  RelationshipDirection,
  Step,
  StepEntityMetadata,
  StepMappedRelationshipMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';
import { collectGraphObjectMetadataFromSteps } from './getSortedJupiterOneTypes';
import { randomUUID } from 'crypto';

function createIntegrationStep({
  entities = [],
  relationships = [],
  mappedRelationships = [],
}: {
  entities?: StepEntityMetadata[];
  relationships?: StepRelationshipMetadata[];
  mappedRelationships?: StepMappedRelationshipMetadata[];
}): Step<any> {
  const stepId = randomUUID();

  return {
    id: `step-${stepId}`,
    name: `Step ${stepId}`,
    entities,
    relationships: relationships,
    mappedRelationships: mappedRelationships,
    executionHandler: () => undefined,
  };
}

function createTestStepRelationshipMetadata(
  partial?: Partial<StepRelationshipMetadata>,
): StepRelationshipMetadata {
  return {
    _class: RelationshipClass.HAS,
    _type: 'relationship_a_b',
    sourceType: 'a',
    targetType: 'b',
    ...partial,
  };
}

function createTestStepMappedRelationshipMetadata(
  partial?: Partial<StepMappedRelationshipMetadata>,
): StepMappedRelationshipMetadata {
  return {
    ...createTestStepRelationshipMetadata(),
    direction: RelationshipDirection.FORWARD,
    ...partial,
  };
}

describe('collectGraphObjectMetadataFromSteps', () => {
  describe('entities', () => {
    test('should de-duplicate entity metadata', () => {
      const stepEntities: StepEntityMetadata[] = [
        {
          resourceName: 'Entity',
          _class: 'Resource',
          _type: 'entity_a',
        },
      ];

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ entities: stepEntities }),
        createIntegrationStep({ entities: stepEntities }),
      ]);

      expect(metadata.entities).toEqual(stepEntities);
    });
  });

  describe('relationships', () => {
    test('should de-duplicate relationship metadata', () => {
      const stepRelationships: StepRelationshipMetadata[] = [
        createTestStepRelationshipMetadata(),
      ];

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ relationships: stepRelationships }),
        createIntegrationStep({ relationships: stepRelationships }),
      ]);

      expect(metadata.relationships).toEqual(stepRelationships);
    });

    test('should not de-duplicate relationship metadata with different _class', () => {
      const r1 = createTestStepRelationshipMetadata();
      const r2 = createTestStepRelationshipMetadata({
        _class: RelationshipClass.IS,
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ relationships: [r1] }),
        createIntegrationStep({ relationships: [r2] }),
      ]);

      expect(metadata.relationships).toEqual([r1, r2]);
    });

    test('should not de-duplicate relationship metadata with different _type', () => {
      const r1 = createTestStepRelationshipMetadata();
      const r2 = createTestStepRelationshipMetadata({
        _type: 'relationship_a_b_2',
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ relationships: [r1] }),
        createIntegrationStep({ relationships: [r2] }),
      ]);

      expect(metadata.relationships).toEqual([r1, r2]);
    });

    test('should not de-duplicate relationship metadata with different sourceType', () => {
      const r1 = createTestStepRelationshipMetadata();
      const r2 = createTestStepRelationshipMetadata({
        sourceType: 'a_2',
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ relationships: [r1] }),
        createIntegrationStep({ relationships: [r2] }),
      ]);

      expect(metadata.relationships).toEqual([r1, r2]);
    });

    test('should not de-duplicate relationship metadata with different targetType', () => {
      const r1 = createTestStepRelationshipMetadata();
      const r2 = createTestStepRelationshipMetadata({
        targetType: 'b_2',
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ relationships: [r1] }),
        createIntegrationStep({ relationships: [r2] }),
      ]);

      expect(metadata.relationships).toEqual([r1, r2]);
    });
  });

  describe('mapped relationships', () => {
    test('should de-duplicate mapped relationship metadata', () => {
      const stepMappedRelationships: StepMappedRelationshipMetadata[] = [
        createTestStepMappedRelationshipMetadata(),
      ];

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ mappedRelationships: stepMappedRelationships }),
        createIntegrationStep({ mappedRelationships: stepMappedRelationships }),
      ]);

      expect(metadata.mappedRelationships).toEqual(stepMappedRelationships);
    });

    test('should not de-duplicate mapped relationship metadata with different _class', () => {
      const r1 = createTestStepMappedRelationshipMetadata();
      const r2 = createTestStepMappedRelationshipMetadata({
        _class: RelationshipClass.IS,
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ mappedRelationships: [r1] }),
        createIntegrationStep({ mappedRelationships: [r2] }),
      ]);

      expect(metadata.mappedRelationships).toEqual([r1, r2]);
    });

    test('should not de-duplicate mapped relationship metadata with different _type', () => {
      const r1 = createTestStepMappedRelationshipMetadata();
      const r2 = createTestStepMappedRelationshipMetadata({
        _type: 'relationship_a_b_2',
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ mappedRelationships: [r1] }),
        createIntegrationStep({ mappedRelationships: [r2] }),
      ]);

      expect(metadata.mappedRelationships).toEqual([r1, r2]);
    });

    test('should not de-duplicate relationship metadata with different sourceType', () => {
      const r1 = createTestStepMappedRelationshipMetadata();
      const r2 = createTestStepMappedRelationshipMetadata({
        sourceType: 'a_2',
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ mappedRelationships: [r1] }),
        createIntegrationStep({ mappedRelationships: [r2] }),
      ]);

      expect(metadata.mappedRelationships).toEqual([r1, r2]);
    });

    test('should not de-duplicate relationship metadata with different targetType', () => {
      const r1 = createTestStepMappedRelationshipMetadata();
      const r2 = createTestStepMappedRelationshipMetadata({
        targetType: 'b_2',
      });

      const metadata = collectGraphObjectMetadataFromSteps([
        createIntegrationStep({ mappedRelationships: [r1] }),
        createIntegrationStep({ mappedRelationships: [r2] }),
      ]);

      expect(metadata.mappedRelationships).toEqual([r1, r2]);
    });
  });
});
