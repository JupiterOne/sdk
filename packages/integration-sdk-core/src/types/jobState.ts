import { Entity, Relationship } from '../types';

export interface GraphObjectFilter {
  _type: string;
}

export type GraphObjectIteratee<T> = (obj: T) => void | Promise<void>;
export type GraphObjectIterateeOptions = {
  concurrency?: number;
};

/**
 * The `JobState` is used to store and retrieve entities and relationships
 * during the execution of an integration. Any step may add objects and
 * dependent steps executed later may load them to build relationships or
 * additional entities.
 */
export interface JobState {
  /**
   * Store arbitrary data for use in dependent steps.
   *
   * Integrations often need a means of storing some information other than
   * entities and relationships for use across steps. This simple mechanism
   * makes no asumptions about the content of the data, and a single value can
   * be stored per key, though the value can be as complex as necessary.
   *
   * This mechanism is not meant to replace storage and retrieval of
   * entities/relationships across steps. That is, this mechanism is for smaller
   * amounts of transient data.
   */
  setData: <T>(key: string, data: T) => Promise<void>;

  /**
   * Retrieve arbitrary data stored by parent steps.
   *
   * Keep in mind that steps are executed in an order that respects the step
   * dependency graph. A step will only see the data stored in previous steps it
   * depends on. Other steps outside the dependency ancestry may not have run
   * and therefore data collected by those other steps should not be expected to
   * exist.
   *
   * @see setData
   */
  getData: <T>(key: string) => Promise<T | undefined>;

  /**
   * Delete arbitrary data stored by parent steps.
   *
   * @see setData
   */
  deleteData: <T>(key: string) => Promise<void>;

  /**
   * Adds an entity to the job's collection. `addEntities` can be used
   * to add a batch of entities to the collection.
   */
  addEntity: (entity: Entity) => Promise<Entity>;

  /**
   * Adds a batch of entities to the job's collection. `addEntity` can be used
   * to add a single entity to the collection.
   */
  addEntities: (entities: Entity[]) => Promise<Entity[]>;

  /**
   * Adds a relationship to the job's collection. `addRelationships` can be used
   * to add a batch of relationships to the collection.
   */
  addRelationship: (relationship: Relationship) => Promise<void>;

  /**
   * Adds a batch of relationships to the job's collection. `addRelationship` can be used
   * to add a single relationship to the collection.
   */
  addRelationships: (relationships: Relationship[]) => Promise<void>;

  /**
   * Finds an entity by `_key` and returns `null` if the entity does not exist.
   *
   * @see hasKey when the entity is not needed to avoid unnecessary costs
   * associated with loading the entity.
   *
   * @throws IntegrationDuplicateKeyError when multiple entities are found with
   * the same `_key` value. Note however, there are mechanisms in place to
   * prevent storing duplicates.
   */
  findEntity: (_key: string | undefined) => Promise<Entity | null>;

  /**
   * Answers `true` when an entity OR relationship having `_key` has been added.
   *
   * @see findEntity when the entity, if present, is needed (there is no need to
   * use `hasKey` before `findEntity`).
   */
  hasKey: (_key: string | undefined) => boolean;

  /**
   * Allows a step to iterate all entities collected into the job state, limited
   * to those that match the provided `filter`.
   *
   * Keep in mind that steps are executed in an order that respects the step
   * dependency graph. A step will only see the entities collected in previous
   * steps it depends on. Other steps outside the dependency ancestry may not
   * have run and therefore entities collected by those other steps should not
   * be expected to exist.
   *
   * If concurrency is specified (defaults to 1), the iteratee will be executed
   * concurrently for graph objects that are found in memory and for
   * graph objects found in a given graph file. No specific ordering is guaranteed.
   * Consideration should be taken for provider rate limits when API requests
   * are being made within the iteratee and also while increasing concurrency
   * beyond the default.
   *
   * Example:
   * await jobState.iterateEntities(
   *   { _type: EcrEntities.ECR_IMAGE._type },
   *   async (image) => {
   *     ...
   *   },
   *   5,
   * );
   */
  iterateEntities: <T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
    options?: GraphObjectIterateeOptions,
  ) => Promise<void>;

  /**
   * Allows a step to iterate all relationships collected into the job state,
   * limited to those that match the provided `filter`.
   *
   * Keep in mind that steps are executed in an order that respects the step
   * dependency graph. A step will only see the relationships collected in
   * previous steps it depends on. Other steps outside the dependency ancestry
   * may not have run and therefore relationships collected by those other steps
   * should not be expected to exist.
   *
   * If concurrency is specified (defaults to 1), the iteratee will be executed
   * concurrently for graph objects that are found in memory and for
   * graph objects found in a given graph file. No specific ordering is guaranteed.
   * Consideration should be taken for provider rate limits when API requests
   * are being made within the iteratee and also while increasing concurrency
   * beyond the default.
   *
   * Example:
   * await jobState.iterateRelationships(
   *   { _type: Relationships.COMPARTMENT_HAS_DOMAIN._type },
   *   async (relationship) => {
   *     ...
   *   },
   *   5,
   * );
   */
  iterateRelationships: <T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
    options?: GraphObjectIterateeOptions,
  ) => Promise<void>;

  /**
   * Ensures all current state is written to persistent storage. It is not
   * necessary to invoke this in an integration; the state is periodically
   * flushed to reduce memory consumption.
   */
  flush: () => Promise<void>;

  /**
   * A job state may be created with a graph object uploader. This function
   * resolves when all uploads have been completed.
   */
  waitUntilUploadsComplete?: () => Promise<void>;
}
