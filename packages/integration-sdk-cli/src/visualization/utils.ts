import { v4 as uuid } from 'uuid';
import { Entity } from '@jupiterone/integration-sdk-core';

export type NodeEntity = Partial<Entity> & { nodeId: string };

/**
 * The nodeId should map back to _key, which ought to be globally unique.
 * Entities set their node ID once, and return if available.
 *
 * If nodeId is not set, first check that the _key isn't already a nodeId for another entity.
 * Duplicates will break vis.js, so we will set nodeId to a UUID (this makes isNodeDuplicate(nodeEntity) === true)
 *
 * If node is not a duplicate, return either the entity _key, or, if unavailable, return a new UUID.
 */
export function getNodeIdFromEntity(
  entity: Partial<NodeEntity>,
  existingEntities: NodeEntity[],
): string {
  if (entity.nodeId !== undefined) {
    return entity.nodeId;
  }

  if (entity._key !== undefined) {
    if (existingEntities.map((e) => e.nodeId).includes(entity._key)) {
      // duplicate key - generate UUID & continue
      // will cause isNodeIdDuplicate to return true
      return uuid();
    }
    return entity._key;
  }
  return uuid();
}

export function isNodeIdDuplicate(entity: NodeEntity): boolean {
  return entity._key !== undefined && entity._key !== entity.nodeId;
}
