import {
  createMappedRelationshipNodesAndEdges,
  isClassMatch,
  findTargetEntity,
  createPlaceholderEntity,
} from '../createMappedRelationshipNodesAndEdges';
import {
  MappedRelationship,
  RelationshipClass,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core/src';

describe('#createMappedRelationshipNodesAndEdges', () => {
  const mappedRelationships = [
    {
      displayName: 'HAS',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: 'key-1',
        targetFilterKeys: [['_key']],
        targetEntity: {
          _key: 'key-2',
        },
      },
      _key: 'abc',
      _type: 'src_has_target',
      _class: 'HAS',
    },
  ];

  test('should return relationship between two existing entities', () => {
    const explicitEntities = [
      {
        _key: 'key-1',
        _type: 'src',
        _class: ['Account'],
      },
      {
        _key: 'key-2',
        _type: 'target',
        _class: ['User'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: 'key-2',
        label: 'HAS',
        dashes: true,
      },
    ]);

    expect(mappedRelationshipNodes).toEqual([]);
  });

  test('should return MISSING entity when sourceEntityKey is not found in explicitEntities', () => {
    const explicitEntities = [
      {
        _key: 'key-2',
        _type: 'target',
        _class: ['User'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: 'key-2',
        label: 'HAS',
        dashes: true,
      },
    ]);

    expect(mappedRelationshipNodes).toMatchObject([
      {
        id: 'key-1',
        color: 'red',
        font: {
          multi: 'html',
        },
        group: 'missing',
        label: '<b>[MISSING ENTITY]</b>\nkey-1',
      },
    ]);
  });

  test('should return PLACEHOLDER entity when targetEntity is not found in entities', () => {
    const explicitEntities = [
      {
        _key: 'key-1',
        _type: 'source',
        _class: ['Acccount'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: 'key-2',
        label: 'HAS',
        dashes: true,
      },
    ]);

    expect(mappedRelationshipNodes).toMatchObject([
      {
        id: 'key-2',
        font: {
          multi: 'html',
        },
        group: 'unknown',
        label: '<b>[PLACEHOLDER ENTITY]</b>\n_key: "key-2"',
      },
    ]);
  });

  test('should only return one PLACEHOLDER entity when found in multiple relationships', () => {
    const mappedRelationships = [
      {
        displayName: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: 'key-1',
          targetFilterKeys: [['_key']],
          targetEntity: {
            _key: '789',
          },
        },
        _key: 'abc',
        _type: 'src_has_target',
        _class: 'HAS',
      },
      {
        displayName: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: 'key-2',
          targetFilterKeys: [['_key']],
          targetEntity: {
            _key: '789',
          },
        },
        _key: 'def',
        _type: 'src_has_target',
        _class: 'HAS',
      },
    ];

    const explicitEntities = [
      {
        _key: 'key-1',
        _type: 'source',
        _class: ['Acccount'],
      },
      {
        _key: 'key-2',
        _type: 'target',
        _class: ['User'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: '789',
        label: 'HAS',
        dashes: true,
      },
      {
        from: 'key-2',
        to: '789',
        label: 'HAS',
        dashes: true,
      },
    ]);

    expect(mappedRelationshipNodes).toMatchObject([
      {
        id: '789',
        font: {
          multi: 'html',
        },
        group: 'unknown',
        label: '<b>[PLACEHOLDER ENTITY]</b>\n_key: "789"',
      },
    ]);
  });

  test('should return UUID for ID when PLACEHOLDER entity when found in multiple relationships', () => {
    const mappedRelationships = [
      {
        displayName: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: 'key-1',
          targetFilterKeys: [['_class']],
          targetEntity: {
            _class: '789',
          },
        },
        _key: 'abc',
        _type: 'src_has_target',
        _class: 'HAS',
      },
      {
        displayName: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: 'key-2',
          targetFilterKeys: [['_class']],
          targetEntity: {
            _class: '789',
          },
        },
        _key: 'def',
        _type: 'src_has_target',
        _class: 'HAS',
      },
    ];

    const explicitEntities = [
      {
        _key: 'key-1',
        _type: 'source',
        _class: ['Acccount'],
      },
      {
        _key: 'key-2',
        _type: 'target',
        _class: ['User'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: expect.any(String),
        label: 'HAS',
        dashes: true,
      },
      {
        from: 'key-2',
        to: expect.any(String),
        label: 'HAS',
        dashes: true,
      },
    ]);
    expect(mappedRelationshipEdges[0].to).toEqual(
      mappedRelationshipEdges[1].to,
    );

    expect(mappedRelationshipNodes).toMatchObject([
      {
        id: mappedRelationshipEdges[0].to,
        font: {
          multi: 'html',
        },
        group: 'unknown',
        label: '<b>[PLACEHOLDER ENTITY]</b>\n_class: "789"',
      },
    ]);
  });

  test('should return node with group === _type when "_type" is targetFilterKey', () => {
    const mappedRelationships = [
      {
        displayName: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: 'key-1',
          targetFilterKeys: [['_type']],
          targetEntity: {
            _type: '789',
          },
        },
        _key: 'abc',
        _type: 'src_has_target',
        _class: 'HAS',
      },
    ];

    const explicitEntities = [
      {
        _key: 'key-1',
        _type: 'source',
        _class: ['Acccount'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: expect.any(String),
        label: 'HAS',
        dashes: true,
      },
    ]);

    expect(mappedRelationshipNodes).toMatchObject([
      {
        id: expect.any(String),
        font: {
          multi: 'html',
        },
        group: '789',
        label: '<b>[PLACEHOLDER ENTITY]</b>\n_type: "789"',
      },
    ]);
  });

  test('should return DUPLICATE KEY when duplicate non-matching entity found', () => {
    const mappedRelationships = [
      {
        displayName: 'HAS',
        _mapping: {
          relationshipDirection: RelationshipDirection.FORWARD,
          sourceEntityKey: 'key-1',
          targetFilterKeys: [['_key', '_type']],
          targetEntity: {
            _key: 'key-2',
            _type: 'non-matching-target',
          },
        },
        _key: 'abc',
        _type: 'src_has_target',
        _class: 'HAS',
      },
    ];

    const explicitEntities = [
      {
        _key: 'key-1',
        _type: 'source',
        _class: ['Acccount'],
      },
      {
        _key: 'key-2',
        _type: 'target',
        _class: ['User'],
      },
    ];

    const { mappedRelationshipEdges, mappedRelationshipNodes } =
      createMappedRelationshipNodesAndEdges({
        mappedRelationships,
        explicitEntities,
      });

    expect(mappedRelationshipEdges).toEqual([
      {
        from: 'key-1',
        to: expect.not.stringContaining('key-2'),
        label: 'HAS',
        dashes: true,
      },
    ]);

    expect(mappedRelationshipNodes).toMatchObject([
      {
        id: mappedRelationshipEdges[0].to,
        color: 'red',
        font: {
          multi: 'html',
        },
        group: 'non-matching-target',
        label:
          '<b>[DUPLICATE _KEY][PLACEHOLDER ENTITY]</b>\n_key: "key-2"\n_type: "non-matching-target"',
      },
    ]);
  });
});

describe('#findTargetEntity', () => {
  test('should not match entity with same key but different other props', () => {
    const _mapping = {
      relationshipDirection: RelationshipDirection.FORWARD,
      sourceEntityKey: 'key-1',
      targetFilterKeys: [['_key', '_type']],
      targetEntity: {
        _key: 'key-2',
        _type: 'non-matching-target',
      },
    };

    const nodeEntities = [
      {
        _key: 'key-2',
        _type: 'target',
        _class: ['User'],
        nodeId: 'key-2',
      },
    ];

    const response = findTargetEntity(nodeEntities, _mapping);

    expect(response).toBeUndefined();
  });
});

describe('#isClassMatch', () => {
  test('should match when matching array', () => {
    expect(isClassMatch(['User'], ['User'])).toEqual(true);
  });

  test('should match when matching string', () => {
    expect(isClassMatch('User', 'User')).toEqual(true);
  });

  test('should match when target string is only element in array', () => {
    expect(isClassMatch(['User'], 'User')).toEqual(true);
  });

  test('should match when target string in array', () => {
    expect(isClassMatch(['User', 'Group'], 'User')).toEqual(true);
  });

  test('should match when target array in array', () => {
    expect(
      isClassMatch(['User', 'Group', 'Account'], ['User', 'Group']),
    ).toEqual(true);
  });

  test('should not match when classes differ', () => {
    expect(isClassMatch('User', 'Group')).toEqual(false);
  });
});

describe('#CreatePlaceholderEntity', () => {
  test('should return object with only targetFilterKey properties', () => {
    const mappedRelationship: MappedRelationship = {
      _class: RelationshipClass.HAS,
      _key: 'key',
      _type: 'type',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: 'source-entity-key',
        targetEntity: {
          _type: 'target-type',
          _key: 'target-key',
          id: 'target-id',
          otherKey: 'otherValue',
        },
        targetFilterKeys: [['_key', '_type']],
      },
    };

    expect(createPlaceholderEntity(mappedRelationship._mapping)).toEqual({
      _key: 'target-key',
      _type: 'target-type',
    });
  });
});
