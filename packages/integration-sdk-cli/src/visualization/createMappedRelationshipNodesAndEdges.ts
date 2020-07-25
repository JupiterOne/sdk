import { Node, Edge } from "vis";
import { Entity, MappedRelationship, RelationshipDirection } from "@jupiterone/integration-sdk-core";
import { isMatch } from "lodash";
import { v4 as uuid } from 'uuid';

interface MappedRelationshipNodesAndEdges {
  mappedRelationshipNodes: Node[];
  mappedRelationshipEdges: Edge[];
}

export function createMappedRelationshipNodesAndEdges(mappedRelationships: MappedRelationship[], explicitEntities: Entity[]): MappedRelationshipNodesAndEdges {
  const mappedRelationshipNodes: Node[] = [];
  const mappedRelationshipEdges: Edge[] = [];

  const entities = [...explicitEntities];

  for (const mappedRelationship of mappedRelationships) {
    let sourceKey = explicitEntities.find((e) => e._key === mappedRelationship._mapping.sourceEntityKey)?._key;
    if (sourceKey === undefined) {
      // This should never happen! The "sourceEntity" ought to exist in the integration.
      const sourceNode = createMissingEntity(mappedRelationship._mapping.sourceEntityKey);
      mappedRelationshipNodes.push(sourceNode);
      sourceKey = sourceNode.id as string;
    }

    let targetKey = entities.find((e) => isMatch(e, mappedRelationship._mapping.targetEntity))?._key;

    if (targetKey === undefined) {
      const targetNode = createPlaceholderEntity(mappedRelationship._mapping.targetEntity);
      entities.push({
        _key: targetNode.id as string,
        ...(mappedRelationship._mapping.targetEntity),
      } as Entity);
      mappedRelationshipNodes.push(targetNode);
      targetKey = targetNode.id
    }

    mappedRelationshipEdges.push(createMappedRelationshipEdge(sourceKey, targetKey, mappedRelationship.displayName, mappedRelationship._mapping.relationshipDirection))
  }

  return {
    mappedRelationshipNodes,
    mappedRelationshipEdges,
  }
}

const MISSING_GROUP = 'missing';

function createMissingEntity(sourceEntityKey: string): Node {
  return {
    id: sourceEntityKey,
    label: `<b>[MISSING ENTITY]</b>\n${sourceEntityKey}`,
    color: 'red',
    group: MISSING_GROUP,
    font: {
      // required: enables displaying <b>text</b> in the label as bold text
      multi: 'html',
    }
  };
}

const UNKNOWN_GROUP = 'unknown';

/**
 * 
 * @param JSONableObject 
 */
function getWrappedJsonString(JSONableObject: object): string {
  const keyValueArray: string[] = [];
  for (const key of Object.keys(JSONableObject)) {
    keyValueArray.push(`${key}: ${JSON.stringify(JSONableObject[key])}`);
  }
  return keyValueArray.join('\n');
}

function createPlaceholderEntity(targetEntity: Partial<Entity>) {
  return {
    id: targetEntity._key || uuid(),
    label: `<b>[PLACEHOLDER ENTITY]</b>\n${getWrappedJsonString(targetEntity)}`,
    group: targetEntity._type || UNKNOWN_GROUP,
    font: {
      // required: enables displaying <b>text</b> in the label as bold text
      multi: 'html',
    }
  }
}

export function createMappedRelationshipEdge(sourceKey: string, targetKey: string, label: string | undefined, relationshipDirection: RelationshipDirection): Edge {
  let fromKey: string;
  let toKey: string;
  switch (relationshipDirection) {
    case RelationshipDirection.FORWARD:
      fromKey = sourceKey;
      toKey = targetKey;
      break;
    case RelationshipDirection.REVERSE:
      fromKey = targetKey;
      toKey = sourceKey;
      break;
  }

  return {
    from: fromKey,
    to: toKey,
    label,
    dashes: true,
  }
}
