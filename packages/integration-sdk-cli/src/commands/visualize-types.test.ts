import {
  RelationshipClass,
  StepGraphObjectMetadataProperties,
} from '@jupiterone/integration-sdk-core';
import { getNodesAndEdgesFromStepMetadata } from './visualize-types';

describe('getNodesAndEdgesFromStepMetadata', () => {
  test('should create node from step metadata', () => {
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

  test('should create edge from step metadata', () => {
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

    expect(getNodesAndEdgesFromStepMetadata(metadata)).toMatchObject({
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
});
