import { createMappedRelationshipNodesAndEdges } from "../createMappedRelationshipNodesAndEdges"
import { RelationshipDirection } from "@jupiterone/integration-sdk-core/src"

const mappedRelationships = [{
  displayName: 'HAS',
  _mapping: {
    relationshipDirection: RelationshipDirection.FORWARD,
    sourceEntityKey: '123',
    targetFilterKeys: ['_key'],
    targetEntity: {
      _key: '456',
    }
  },
  _key: 'abc',
  _type: 'src_has_target',
  _class: 'HAS',
}];

test('should return relationship between two existing entities', () => {
  const explicitEntities = [
    {
      _key: '123',
      _type: 'src',
      _class: ['Account'],
    },
    {
      _key: '456',
      _type: 'target',
      _class: ['User'],
    }
  ]

  const {
    mappedRelationshipEdges,
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges(mappedRelationships, explicitEntities);

  expect(mappedRelationshipEdges).toEqual([
    {
      from: '123',
      to: '456',
      label: 'HAS',
      dashes: true,
    }
  ]);

  expect(mappedRelationshipNodes).toEqual([]);
});

test('should return MISSING entity when sourceEntityKey is not found in explicitEntities', () => {
  const explicitEntities = [
    {
      _key: '456',
      _type: 'target',
      _class: ['User'],
    }
  ]

  const {
    mappedRelationshipEdges,
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges(mappedRelationships, explicitEntities);

  expect(mappedRelationshipEdges).toEqual([
    {
      from: '123',
      to: '456',
      label: 'HAS',
      dashes: true,
    }
  ]);

  expect(mappedRelationshipNodes).toEqual([
    {
      id: '123',
      color: 'red',
      font: {
        multi: 'html'
      },
      group: 'missing',
      label: '<b>[MISSING ENTITY]</b>\n123',
    }
  ]);
});

test('should return PLACEHOLDER entity when targetEntity is not found in entities', () => {
  const explicitEntities = [
    {
      _key: '123',
      _type: 'source',
      _class: ['Acccount'],
    }
  ]

  const {
    mappedRelationshipEdges,
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges(mappedRelationships, explicitEntities);

  expect(mappedRelationshipEdges).toEqual([
    {
      from: '123',
      to: '456',
      label: 'HAS',
      dashes: true,
    }
  ]);

  expect(mappedRelationshipNodes).toEqual([
    {
      id: '456',
      font: {
        multi: 'html'
      },
      group: 'unknown',
      label: '<b>[PLACEHOLDER ENTITY]</b>\n_key: "456"',
    }
  ]);
});

test('should only return one PLACEHOLDER entity when found in multiple relationships', () => {
  const mappedRelationships = [
    {
      displayName: 'HAS',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: '123',
        targetFilterKeys: ['_key'],
        targetEntity: {
          _key: '789',
        }
      },
      _key: 'abc',
      _type: 'src_has_target',
      _class: 'HAS',
    },
    {
      displayName: 'HAS',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: '456',
        targetFilterKeys: ['_key'],
        targetEntity: {
          _key: '789',
        }
      },
      _key: 'def',
      _type: 'src_has_target',
      _class: 'HAS',
    }
  ];
  
  const explicitEntities = [
    {
      _key: '123',
      _type: 'source',
      _class: ['Acccount'],
    },
    {
      _key: '456',
      _type: 'target',
      _class: ['User'],
    }
  ]

  const {
    mappedRelationshipEdges,
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges(mappedRelationships, explicitEntities);

  expect(mappedRelationshipEdges).toEqual([
    {
      from: '123',
      to: '789',
      label: 'HAS',
      dashes: true,
    },
    {
      from: '456',
      to: '789',
      label: 'HAS',
      dashes: true,
    },
  ]);

  expect(mappedRelationshipNodes).toEqual([
    {
      id: '789',
      font: {
        multi: 'html'
      },
      group: 'unknown',
      label: '<b>[PLACEHOLDER ENTITY]</b>\n_key: "789"',
    }
  ]);
});


test('should return UUID for ID when PLACEHOLDER entity when found in multiple relationships', () => {
  const mappedRelationships = [
    {
      displayName: 'HAS',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: '123',
        targetFilterKeys: ['_class'],
        targetEntity: {
          _class: '789',
        }
      },
      _key: 'abc',
      _type: 'src_has_target',
      _class: 'HAS',
    },
    {
      displayName: 'HAS',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: '456',
        targetFilterKeys: ['_class'],
        targetEntity: {
          _class: '789',
        }
      },
      _key: 'def',
      _type: 'src_has_target',
      _class: 'HAS',
    }
  ];
  
  const explicitEntities = [
    {
      _key: '123',
      _type: 'source',
      _class: ['Acccount'],
    },
    {
      _key: '456',
      _type: 'target',
      _class: ['User'],
    }
  ]

  const {
    mappedRelationshipEdges,
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges(mappedRelationships, explicitEntities);

  expect(mappedRelationshipEdges).toEqual([
    {
      from: '123',
      to: expect.any(String),
      label: 'HAS',
      dashes: true,
    },
    {
      from: '456',
      to: expect.any(String),
      label: 'HAS',
      dashes: true,
    },
  ]);
  expect(mappedRelationshipEdges[0].to).toEqual(mappedRelationshipEdges[1].to);

  expect(mappedRelationshipNodes).toEqual([
    {
      id: mappedRelationshipEdges[0].to,
      font: {
        multi: 'html'
      },
      group: 'unknown',
      label: '<b>[PLACEHOLDER ENTITY]</b>\n_class: "789"',
    }
  ]);
});


test('should return node with group === _type when "_type" is targetFilterKey', () => {
  const mappedRelationships = [
    {
      displayName: 'HAS',
      _mapping: {
        relationshipDirection: RelationshipDirection.FORWARD,
        sourceEntityKey: '123',
        targetFilterKeys: ['_type'],
        targetEntity: {
          _type: '789',
        }
      },
      _key: 'abc',
      _type: 'src_has_target',
      _class: 'HAS',
    }
  ];
  
  const explicitEntities = [
    {
      _key: '123',
      _type: 'source',
      _class: ['Acccount'],
    }
  ]

  const {
    mappedRelationshipEdges,
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges(mappedRelationships, explicitEntities);

  expect(mappedRelationshipEdges).toEqual([
    {
      from: '123',
      to: expect.any(String),
      label: 'HAS',
      dashes: true,
    },
  ]);

  expect(mappedRelationshipNodes).toEqual([
    {
      id: expect.any(String),
      font: {
        multi: 'html'
      },
      group: '789',
      label: '<b>[PLACEHOLDER ENTITY]</b>\n_type: "789"',
    }
  ]);
});

