import { Node, Edge, NodeOptions } from 'vis';
import {
  Entity,
  MappedRelationship,
  RelationshipDirection,
  RelationshipMapping,
  TargetEntityProperties,
} from '@jupiterone/integration-sdk-core';
import { isMatch, pick } from 'lodash';
import { getNodeIdFromEntity, NodeEntity, isNodeIdDuplicate } from './utils';

interface MappedRelationshipNodesAndEdges {
  mappedRelationshipNodes: Node[];
  mappedRelationshipEdges: Edge[];
}

export function isClassMatch(
  entityClasses: string | string[] | undefined,
  targetEntityClasses: string | string[] | undefined,
): boolean {
  if (targetEntityClasses === undefined) {
    return true;
  } else if (!Array.isArray(targetEntityClasses)) {
    targetEntityClasses = [targetEntityClasses];
  }

  if (entityClasses === undefined) {
    return false;
  } else if (!Array.isArray(entityClasses)) {
    entityClasses = [entityClasses];
  }

  return targetEntityClasses.every((targetClass) =>
    (entityClasses as string[]).includes(targetClass),
  );
}

export function findTargetEntity(
  entities: NodeEntity[],
  _mapping: RelationshipMapping,
): NodeEntity | undefined {
  for (const targetFilterKey of _mapping.targetFilterKeys) {
    const targetEntity = pick(_mapping.targetEntity, targetFilterKey);

    const matchedEntity = entities.find((entity) => {
      const { _class: entityClass, ...entityRest } = entity;
      const { _class: targetEntityClass, ...targetEntityRest } = targetEntity;

      return (
        isMatch(entityRest, targetEntityRest) &&
        isClassMatch(
          entityClass,
          targetEntityClass as string | string[] | undefined,
        )
      );
    });

    if (matchedEntity !== undefined) return matchedEntity;
  }
}

type NewMissingEntity = { _key: string };

function isNewMissingEntity(
  sourceEntity: NodeEntity | NewMissingEntity,
): sourceEntity is NewMissingEntity {
  return (sourceEntity as any).nodeId === undefined;
}

function findOrCreateSourceEntity(
  explicitEntities: NodeEntity[],
  sourceEntityKey: string,
): NodeEntity | NewMissingEntity {
  const sourceEntity = explicitEntities.find((e) => e._key === sourceEntityKey);
  if (sourceEntity === undefined) {
    // This should never happen! The "sourceEntity" ought to exist in the integration.
    return {
      _key: sourceEntityKey,
    };
  } else {
    return sourceEntity;
  }
}

type NewPlaceholderEntity = TargetEntityProperties;

function isNewPlaceholderEntity(
  targetEntity: NodeEntity | NewPlaceholderEntity,
): targetEntity is NewPlaceholderEntity {
  return (targetEntity as any).nodeId === undefined;
}

function findOrCreatePlaceholderEntity(
  nodeEntities: NodeEntity[],
  _mapping: RelationshipMapping,
): NodeEntity | NewPlaceholderEntity {
  const targetEntity = findTargetEntity(nodeEntities, _mapping);
  if (targetEntity === undefined) {
    const newPlaceholderEntity = {};
    for (const filterKey of _mapping.targetFilterKeys) {
      const keys = Array.isArray(filterKey) ? filterKey : [filterKey];
      for (const key of keys) {
        newPlaceholderEntity[key] = _mapping.targetEntity[key];
      }
    }
    return newPlaceholderEntity;
  } else {
    return targetEntity;
  }
}

export function createMappedRelationshipNodesAndEdges(options: {
  mappedRelationships: MappedRelationship[];
  explicitEntities: Entity[];
}): MappedRelationshipNodesAndEdges {
  const { mappedRelationships, explicitEntities } = options;
  const mappedRelationshipNodes: Node[] = [];
  const mappedRelationshipEdges: Edge[] = [];

  const explicitNodeEntities: NodeEntity[] = [
    ...explicitEntities.map((e) => ({
      ...e,
      nodeId: getNodeIdFromEntity(e, []),
    })),
  ];
  const missingNodeEntities: NodeEntity[] = [];
  const placeholderNodeEntities: NodeEntity[] = [];

  for (const mappedRelationship of mappedRelationships) {
    const sourceEntity = findOrCreateSourceEntity(
      [...explicitNodeEntities, ...missingNodeEntities],
      mappedRelationship._mapping.sourceEntityKey,
    );
    let sourceNodeId: string;
    if (isNewMissingEntity(sourceEntity)) {
      const missingSourceEntity = {
        ...sourceEntity,
        nodeId: getNodeIdFromEntity(sourceEntity, [
          ...explicitNodeEntities,
          ...missingNodeEntities,
          ...placeholderNodeEntities,
        ]),
      };
      missingNodeEntities.push(missingSourceEntity);

      const sourceNode = createMissingEntityNode(missingSourceEntity);
      mappedRelationshipNodes.push(sourceNode);
      sourceNodeId = missingSourceEntity.nodeId;
    } else {
      sourceNodeId = getNodeIdFromEntity(sourceEntity, [
        ...explicitNodeEntities,
        ...missingNodeEntities,
        ...placeholderNodeEntities,
      ]);
    }

    const targetEntity = findOrCreatePlaceholderEntity(
      [
        ...explicitNodeEntities,
        ...missingNodeEntities,
        ...placeholderNodeEntities,
      ],
      mappedRelationship._mapping,
    );
    let targetNodeId: string;
    if (isNewPlaceholderEntity(targetEntity)) {
      const placeholderTargetEntity = {
        ...targetEntity,
        nodeId: getNodeIdFromEntity(targetEntity, [
          ...explicitNodeEntities,
          ...missingNodeEntities,
          ...placeholderNodeEntities,
        ]),
      };
      placeholderNodeEntities.push(placeholderTargetEntity);

      const targetNode = createPlaceholderEntityNode(placeholderTargetEntity);
      mappedRelationshipNodes.push(targetNode);
      targetNodeId = placeholderTargetEntity.nodeId;
    } else {
      targetNodeId = getNodeIdFromEntity(targetEntity, [
        ...explicitNodeEntities,
        ...missingNodeEntities,
        ...placeholderNodeEntities,
      ]);
    }

    mappedRelationshipEdges.push(
      createMappedRelationshipEdge(
        sourceNodeId,
        targetNodeId,
        mappedRelationship.displayName,
        mappedRelationship._mapping.relationshipDirection,
      ),
    );
  }

  return {
    mappedRelationshipNodes,
    mappedRelationshipEdges,
  };
}

function createEntityNode(
  node: Node,
  options: {
    isDuplicateId?: boolean;
    labelHeader?: string;
    labelBody?: string;
  },
): Node {
  const overrides: Partial<NodeOptions> = {};
  const labelBody = options.labelBody || node.label;
  if (options.isDuplicateId === true) {
    options.labelHeader = '[DUPLICATE _KEY]' + options.labelHeader || '';
    overrides.color = 'red';
  }

  if (options.labelHeader !== undefined) {
    overrides.label = `<b>${options.labelHeader}</b>\n${labelBody}`;
    overrides.font = { multi: 'html' };
  }
  return {
    ...node,
    ...overrides,
  };
}

const MISSING_GROUP = 'missing';

function createMissingEntityNode(sourceEntity: NodeEntity): Node {
  return createEntityNode(
    {
      id: sourceEntity.nodeId,
      color: 'red',
      group: MISSING_GROUP,
    },
    {
      isDuplicateId: isNodeIdDuplicate(sourceEntity),
      labelHeader: '[MISSING ENTITY]',
      labelBody: sourceEntity._key,
    },
  );
}

const UNKNOWN_GROUP = 'unknown';

/**
 *
 * @param JSONableObject
 */
function getWrappedJsonString(options: {
  JSONableObject: object;
  keysToOmit: string[];
}): string {
  const { JSONableObject, keysToOmit } = options;
  const keyValueArray: string[] = [];
  for (const key of Object.keys(JSONableObject)) {
    if (!keysToOmit.includes(key)) {
      keyValueArray.push(`${key}: ${JSON.stringify(JSONableObject[key])}`);
    }
  }
  return keyValueArray.join('\n');
}

function getWrappedEntityPropertiesString(nodeEntity: NodeEntity): string {
  return getWrappedJsonString({
    JSONableObject: nodeEntity,
    keysToOmit: ['nodeId'],
  });
}

function createPlaceholderEntityNode(targetEntity: NodeEntity) {
  return createEntityNode(
    {
      id: targetEntity.nodeId,
      group: targetEntity._type || UNKNOWN_GROUP,
      shapeProperties: { borderDashes: true },
    },
    {
      isDuplicateId: isNodeIdDuplicate(targetEntity),
      labelHeader: '[PLACEHOLDER ENTITY]',
      labelBody: getWrappedEntityPropertiesString(targetEntity),
    },
  );
}

export function createMappedRelationshipEdge(
  sourceNodeId: string,
  targetNodeId: string,
  label: string | undefined,
  relationshipDirection: RelationshipDirection,
): Edge {
  let fromKey: string;
  let toKey: string;
  switch (relationshipDirection) {
    case RelationshipDirection.FORWARD:
      fromKey = sourceNodeId;
      toKey = targetNodeId;
      break;
    case RelationshipDirection.REVERSE:
      fromKey = targetNodeId;
      toKey = sourceNodeId;
      break;
  }

  return {
    from: fromKey,
    to: toKey,
    label,
    dashes: true,
  };
}
