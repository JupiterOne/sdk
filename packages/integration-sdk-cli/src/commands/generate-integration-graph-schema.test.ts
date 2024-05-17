import {
  IntegrationInstanceConfig,
  IntegrationStep,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';
import { getMockIntegrationStep } from '@jupiterone/integration-sdk-private-test-utils';
import { generateIntegrationGraphSchema } from './generate-integration-graph-schema';

describe('#generateIntegrationGraphSchema', () => {
  test('should return aggregate schema from steps', () => {
    const steps: IntegrationStep<IntegrationInstanceConfig>[] = [
      getMockIntegrationStep({
        entities: [
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
          },
          {
            _class: 'Group',
            _type: 'my_group',
            resourceName: 'The group',
          },
        ],
        mappedRelationships: [
          {
            _class: RelationshipClass.IS,
            sourceType: 'my_user',
            targetType: 'employee',
            direction: RelationshipDirection.FORWARD,
            _type: 'my_user_is_employee',
          },
        ],
      }),
      getMockIntegrationStep({
        entities: [
          {
            _class: 'Group',
            _type: 'my_group',
            resourceName: 'The group',
          },
        ],
        relationships: [
          {
            _class: RelationshipClass.HAS,
            _type: 'my_group_has_user',
            sourceType: 'my_user',
            targetType: 'my_group',
          },
        ],
        mappedRelationships: [],
      }),
    ];

    expect(generateIntegrationGraphSchema(steps)).toEqual({
      entities: [
        {
          _class: 'User',
          _type: 'my_user',
          resourceName: 'The user',
        },
        {
          _class: 'Group',
          _type: 'my_group',
          resourceName: 'The group',
        },
      ],
      relationships: [
        {
          _class: RelationshipClass.HAS,
          sourceType: 'my_user',
          targetType: 'my_group',
        },
      ],
      mappedRelationships: [
        {
          _class: RelationshipClass.IS,
          sourceType: 'my_user',
          targetType: 'employee',
          direction: RelationshipDirection.FORWARD,
        },
      ],
    });
  });

  test('should dedup entity metadata', () => {
    const steps: IntegrationStep<IntegrationInstanceConfig>[] = [
      getMockIntegrationStep({
        entities: [
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
          },
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
          },
        ],
        relationships: [],
        mappedRelationships: [],
      }),
      getMockIntegrationStep({
        entities: [
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
          },
        ],
        relationships: [],
        mappedRelationships: [],
      }),
    ];

    expect(generateIntegrationGraphSchema(steps)).toEqual({
      entities: [
        {
          _class: 'User',
          _type: 'my_user',
          resourceName: 'The user',
        },
      ],
      relationships: [],
      mappedRelationships: [],
    });
  });

  test('should dedup entity metadata with schema', () => {
    const steps: IntegrationStep<IntegrationInstanceConfig>[] = [
      getMockIntegrationStep({
        entities: [
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
            schema: {
              $id: 'id',
            },
          },
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
            schema: {
              $id: 'id',
            },
          },
        ],
        relationships: [],
        mappedRelationships: [],
      }),
      getMockIntegrationStep({
        entities: [
          {
            _class: 'User',
            _type: 'my_user',
            resourceName: 'The user',
            schema: {
              $id: 'id',
            },
          },
        ],
        relationships: [],
        mappedRelationships: [],
      }),
    ];

    expect(generateIntegrationGraphSchema(steps)).toEqual({
      entities: [
        {
          _class: 'User',
          _type: 'my_user',
          resourceName: 'The user',
          schema: {
            $id: 'id',
          },
        },
      ],
      relationships: [],
      mappedRelationships: [],
    });
  });

  test('should dedup relationship metadata', () => {
    const steps: IntegrationStep<IntegrationInstanceConfig>[] = [
      getMockIntegrationStep({
        entities: [],
        relationships: [
          {
            _class: RelationshipClass.HAS,
            _type: 'my_group_has_user',
            sourceType: 'my_user',
            targetType: 'my_group',
          },
          {
            _class: RelationshipClass.HAS,
            _type: 'my_group_has_user',
            sourceType: 'my_user',
            targetType: 'my_group',
          },
        ],
        mappedRelationships: [],
      }),
      getMockIntegrationStep({
        entities: [],
        relationships: [
          {
            _class: RelationshipClass.HAS,
            _type: 'my_group_has_user',
            sourceType: 'my_user',
            targetType: 'my_group',
          },
        ],
        mappedRelationships: [],
      }),
    ];

    expect(generateIntegrationGraphSchema(steps)).toEqual({
      entities: [],
      relationships: [
        {
          _class: RelationshipClass.HAS,
          sourceType: 'my_user',
          targetType: 'my_group',
        },
      ],
      mappedRelationships: [],
    });
  });

  test('should dedup mapped relationship metadata', () => {
    const steps: IntegrationStep<IntegrationInstanceConfig>[] = [
      getMockIntegrationStep({
        entities: [],
        relationships: [],
        mappedRelationships: [
          {
            _class: RelationshipClass.IS,
            sourceType: 'my_user',
            targetType: 'employee',
            direction: RelationshipDirection.FORWARD,
            _type: 'my_user_is_employee',
          },
          {
            _class: RelationshipClass.IS,
            sourceType: 'my_user',
            targetType: 'employee',
            direction: RelationshipDirection.FORWARD,
            _type: 'my_user_is_employee',
          },
        ],
      }),
      getMockIntegrationStep({
        entities: [],
        relationships: [],
        mappedRelationships: [
          {
            _class: RelationshipClass.IS,
            sourceType: 'my_user',
            targetType: 'employee',
            direction: RelationshipDirection.FORWARD,
            _type: 'my_user_is_employee',
          },
        ],
      }),
    ];

    expect(generateIntegrationGraphSchema(steps)).toEqual({
      entities: [],
      relationships: [],
      mappedRelationships: [
        {
          _class: RelationshipClass.IS,
          sourceType: 'my_user',
          targetType: 'employee',
          direction: RelationshipDirection.FORWARD,
        },
      ],
    });
  });
});
