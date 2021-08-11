import {
  RelationshipClass,
  RelationshipDirection,
  StepGraphObjectMetadataProperties,
} from '@jupiterone/integration-sdk-core';
import {
  getNodesAndEdgesFromStepMetadata,
  MAPPED_RELATIONSHIP_OPTIONS,
  PLACEHOLDER_ENTITY_OPTIONS,
} from './visualize-types';

describe('getNodesAndEdgesFromStepMetadata', () => {
  test('should create node from entity metadata', () => {
    const metadata: StepGraphObjectMetadataProperties = {
      entities: [
        {
          resourceName: 'User Group',
          _type: 'user_group',
          _class: 'UserGroup',
        },
      ],
      relationships: [],
    };

    expect(getNodesAndEdgesFromStepMetadata(metadata)).toMatchObject({
      nodes: [
        {
          id: 'user_group',
          label: expect.any(String),
        },
      ],
      edges: [],
    });
  });

  test('should create edge from relationship metadata', () => {
    const metadata: StepGraphObjectMetadataProperties = {
      entities: [
        {
          resourceName: 'User Group',
          _type: 'user_group',
          _class: 'UserGroup',
        },
      ],
      relationships: [
        {
          _type: 'user_group_contains_group',
          sourceType: 'user_group',
          _class: RelationshipClass.CONTAINS,
          targetType: 'user_group',
        },
      ],
    };

    expect(getNodesAndEdgesFromStepMetadata(metadata)).toEqual({
      nodes: [
        {
          id: 'user_group',
          label: expect.any(String),
        },
      ],
      edges: [
        {
          from: 'user_group',
          label: 'CONTAINS',
          to: 'user_group',
        },
      ],
    });
  });

  test('should create mapped edge and placeholder node from mapped relationship metadata', () => {
    const metadata: StepGraphObjectMetadataProperties = {
      entities: [
        {
          resourceName: 'User Group',
          _type: 'user_group',
          _class: 'UserGroup',
        },
      ],
      relationships: [],
      mappedRelationships: [
        {
          _type: 'user_group_contains_google_user',
          sourceType: 'user_group',
          _class: RelationshipClass.CONTAINS,
          targetType: 'google_user',
          direction: RelationshipDirection.FORWARD,
        },
      ],
    };

    expect(getNodesAndEdgesFromStepMetadata(metadata)).toEqual({
      nodes: [
        {
          id: 'user_group',
          label: expect.any(String),
        },
        {
          id: 'google_user',
          label: expect.any(String),
          ...PLACEHOLDER_ENTITY_OPTIONS,
        },
      ],
      edges: [
        {
          from: 'user_group',
          label: 'CONTAINS',
          to: 'google_user',
          ...MAPPED_RELATIONSHIP_OPTIONS,
        },
      ],
    });
  });

  test('should create mapped edge and NO node from mapped relationship metadata when targetType already exists', () => {
    const metadata: StepGraphObjectMetadataProperties = {
      entities: [
        {
          resourceName: 'User Group',
          _type: 'user_group',
          _class: 'UserGroup',
        },
      ],
      relationships: [],
      mappedRelationships: [
        {
          _type: 'user_group_contains_user_group',
          sourceType: 'user_group',
          _class: RelationshipClass.CONTAINS,
          targetType: 'user_group',
          direction: RelationshipDirection.FORWARD,
        },
      ],
    };

    expect(getNodesAndEdgesFromStepMetadata(metadata)).toEqual({
      nodes: [
        {
          id: 'user_group',
          label: expect.any(String),
        },
      ],
      edges: [
        {
          from: 'user_group',
          label: 'CONTAINS',
          to: 'user_group',
          ...MAPPED_RELATIONSHIP_OPTIONS,
        },
      ],
    });
  });

  test('should create just one placeholder node when multiple mapped relationships target same type', () => {
    const metadata: StepGraphObjectMetadataProperties = {
      entities: [
        {
          resourceName: 'User Group',
          _type: 'user_group',
          _class: 'UserGroup',
        },
        {
          resourceName: 'User',
          _type: 'user',
          _class: 'User',
        },
      ],
      relationships: [],
      mappedRelationships: [
        {
          _type: 'user_group_contains_google_user',
          sourceType: 'user_group',
          _class: RelationshipClass.CONTAINS,
          targetType: 'google_user',
          direction: RelationshipDirection.FORWARD,
        },
        {
          _type: 'user_is_google_user',
          sourceType: 'user',
          _class: RelationshipClass.IS,
          targetType: 'google_user',
          direction: RelationshipDirection.FORWARD,
        },
      ],
    };

    expect(getNodesAndEdgesFromStepMetadata(metadata)).toEqual({
      nodes: [
        {
          id: 'user_group',
          label: expect.any(String),
        },
        {
          id: 'user',
          label: expect.any(String),
        },
        {
          id: 'google_user',
          label: expect.any(String),
          ...PLACEHOLDER_ENTITY_OPTIONS,
        },
      ],
      edges: [
        {
          from: 'user_group',
          label: 'CONTAINS',
          to: 'google_user',
          ...MAPPED_RELATIONSHIP_OPTIONS,
        },
        {
          from: 'user',
          label: 'IS',
          to: 'google_user',
          ...MAPPED_RELATIONSHIP_OPTIONS,
        },
      ],
    });
  });
});
