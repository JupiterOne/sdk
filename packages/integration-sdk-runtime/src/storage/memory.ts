import {
  Entity,
  GraphObjectFilter,
  GraphObjectIteratee,
  IntegrationMissingKeyError,
  Relationship,
} from '@jupiterone/integration-sdk-core';

export interface GraphObjectMetadata {
  stepId: string;
}

interface InMemoryGraphObjectStoreEntityData extends GraphObjectMetadata {
  entity: Entity;
}

interface InMemoryGraphObjectStoreRelationshipData extends GraphObjectMetadata {
  relationship: Relationship;
}

/**
 * Stores entities and relationships in memory and may be used to buffer data in
 * memory before flushing to another datastore (e.g. disk).
 */
export class InMemoryGraphObjectStore {
  /**
   * Maps to lookup entity/relationship with metadata by _key
   *
   * {
   *   "my_user_key1": { stepId: 'fetch-users', entity: { ...ENTITY1 } },
   *   "my_user_key2": { stepId: 'fetch-users', entity: { ...ENTITY2 } }
   * }
   */
  private readonly entityKeyToEntityMap = new Map<
    string,
    InMemoryGraphObjectStoreEntityData
  >();
  private readonly relationshipKeyToRelationshipMap = new Map<
    string,
    InMemoryGraphObjectStoreRelationshipData
  >();

  /**
   * Maps to lookup all entity/relationship _key's by _type. The value of this
   * data structure is Map<_key{string}, boolean> to make deleting individual
   * keys super fast. See "flushEntities" for more information.
   *
   * {
   *   'my_token_type': {
   *     'my_token_key1': true,
   *     'my_token_key2': true
   *   },
   *   'my_user_type': {
   *     'my_user_key1': true,
   *     'my_user_key2': true
   *   }
   * }
   */
  private readonly entityTypeToKeysMap: Map<
    string,
    Map<string, boolean>
  > = new Map();
  private readonly relationshipTypeToKeysMap: Map<
    string,
    Map<string, boolean>
  > = new Map();

  addEntities(stepId: string, newEntities: Entity[]): void {
    for (const entity of newEntities) {
      this.entityKeyToEntityMap.set(entity._key, {
        stepId,
        entity,
      });

      const entityTypeKeysMap = this.entityTypeToKeysMap.get(entity._type);
      if (entityTypeKeysMap) {
        entityTypeKeysMap.set(entity._key, true);
      } else {
        this.entityTypeToKeysMap.set(
          entity._type,
          new Map<string, boolean>([[entity._key, true]]),
        );
      }
    }
  }

  addRelationships(stepId: string, newRelationships: Relationship[]): void {
    for (const relationship of newRelationships) {
      this.relationshipKeyToRelationshipMap.set(relationship._key, {
        stepId,
        relationship,
      });

      const relationshipTypeKeysMap = this.relationshipTypeToKeysMap.get(
        relationship._type,
      );

      if (relationshipTypeKeysMap) {
        relationshipTypeKeysMap.set(relationship._key, true);
      } else {
        this.relationshipTypeToKeysMap.set(
          relationship._type,
          new Map<string, boolean>([[relationship._key, true]]),
        );
      }
    }
  }

  findEntity(_key: string): Entity | undefined {
    return this.entityKeyToEntityMap.get(_key)?.entity;
  }

  async iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void> {
    const entityTypeKeysMap = this.entityTypeToKeysMap.get(filter._type);

    if (!entityTypeKeysMap) {
      return;
    }

    for (const [_key] of entityTypeKeysMap) {
      const graphObjectData = this.entityKeyToEntityMap.get(_key);

      if (!graphObjectData) {
        // NOTE: This should never happen. Our data structures should stay in
        // sync.
        throw new IntegrationMissingKeyError(
          `Failed to find entity (_type=${filter._type}, _key=${_key})`,
        );
      }

      await iteratee(graphObjectData.entity as T);
    }
  }

  async iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void> {
    const relationshipTypeKeysMap = this.relationshipTypeToKeysMap.get(
      filter._type,
    );

    if (!relationshipTypeKeysMap) {
      return;
    }

    for (const [_key] of relationshipTypeKeysMap) {
      const graphObjectData = this.relationshipKeyToRelationshipMap.get(_key);

      if (!graphObjectData) {
        // NOTE: This should never happen. Our data structures should stay in
        // sync.
        throw new IntegrationMissingKeyError(
          `Failed to find relationship (_type=${filter._type}, _key=${_key})`,
        );
      }

      await iteratee(graphObjectData.relationship as T);
    }
  }

  /**
   * Instead of clearing the entire map, we want to delete old data individually.
   * This will allow us to eventually run steps in parallel without locking when
   * steps have no interdependence. If we cleared it out, it's possible that
   * two steps could be running in parallel and one of the steps may clear out
   * the maps while the other is still relying on it.
   */
  flushEntities(entities: Entity[]) {
    for (const entity of entities) {
      this.entityKeyToEntityMap.delete(entity._key);
      const entityTypeKeysMap = this.entityTypeToKeysMap.get(entity._type);

      if (!entityTypeKeysMap) {
        // NOTE: This should never happen. It's an indicator that there is a
        // bug in keeping our two maps in syc.
        throw new Error(
          `Could not delete entity from type keys map (_key=${entity._key}, _type=${entity._type})`,
        );
      }

      entityTypeKeysMap.delete(entity._key);
    }
  }

  /**
   * Instead of clearing the entire map, we want to delete old data individually.
   * This will allow us to eventually run steps in parallel without locking when
   * steps have no interdependence. If we cleared it out, it's possible that
   * two steps could be running in parallel and one of the steps may clear out
   * the maps while the other is still relying on it.
   */
  flushRelationships(relationships: Relationship[]) {
    for (const relationship of relationships) {
      this.relationshipKeyToRelationshipMap.delete(relationship._key);
      const relationshipTypeKeysMap = this.relationshipTypeToKeysMap.get(
        relationship._type,
      );

      if (!relationshipTypeKeysMap) {
        // NOTE: This should never happen. It's an indicator that there is a
        // bug in keeping our two maps in syc.
        throw new Error(
          `Could not delete relationship from type keys map (_key=${relationship._key}, _type=${relationship._type})`,
        );
      }

      relationshipTypeKeysMap.delete(relationship._key);
    }
  }

  collectEntitiesByStep(onlyThisStepId?: string): Map<string, Entity[]> {
    const entitiesByStepMap = new Map<string, Entity[]>();

    for (const [_key, graphObjectData] of this.entityKeyToEntityMap) {
      const { stepId, entity } = graphObjectData;
      if (onlyThisStepId && onlyThisStepId !== stepId) continue;

      const entitiesByStepArray = entitiesByStepMap.get(stepId);
      if (entitiesByStepArray) {
        entitiesByStepArray.push(entity);
      } else {
        entitiesByStepMap.set(stepId, [entity]);
      }
    }

    return entitiesByStepMap;
  }

  collectRelationshipsByStep(
    onlyThisStepId?: string,
  ): Map<string, Relationship[]> {
    const relationshipsByStepMap = new Map<string, Relationship[]>();

    for (const [_key, graphObjectData] of this
      .relationshipKeyToRelationshipMap) {
      const { stepId, relationship } = graphObjectData;
      if (onlyThisStepId && onlyThisStepId !== stepId) continue;

      const relationshipsByStepArray = relationshipsByStepMap.get(stepId);
      if (relationshipsByStepArray) {
        relationshipsByStepArray.push(relationship);
      } else {
        relationshipsByStepMap.set(stepId, [relationship]);
      }
    }

    return relationshipsByStepMap;
  }

  getTotalEntityItemCount() {
    return this.entityKeyToEntityMap.size;
  }

  getTotalRelationshipItemCount() {
    return this.relationshipKeyToRelationshipMap.size;
  }
}
