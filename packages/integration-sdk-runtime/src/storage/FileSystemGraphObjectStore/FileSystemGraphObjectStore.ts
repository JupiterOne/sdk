import { Sema } from 'async-sema';

import {
  Entity,
  GraphObjectFilter,
  GraphObjectIteratee,
  Relationship,
  GraphObjectStore,
  GraphObjectIndexMetadata,
  GetIndexMetadataForGraphObjectTypeParams,
  IntegrationStep,
} from '@jupiterone/integration-sdk-core';

import { flushDataToDisk } from './flushDataToDisk';
import {
  iterateEntityTypeIndex,
  iterateRelationshipTypeIndex,
  readGraphObjectFile,
} from './indices';
import { InMemoryGraphObjectStore } from '../memory';
import { FlushedEntityData } from '../types';
import { getRootStorageAbsolutePath } from '../../fileSystem';
import { BigMap } from '../../execution/utils/bigMap';
import { chunk, min } from 'lodash';
import { DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES } from '../../synchronization';

export const DEFAULT_GRAPH_OBJECT_BUFFER_THRESHOLD = 500;
export const DEFAULT_GRAPH_OBJECT_FILE_SIZE = 500;

// no more than 2^30 bytes (1GB)
export const MAX_GRAPH_OBJECT_BUFFER_THRESHOLD_IN_BYTES =
  1_073_741_824 as const;

// it is important that this value is set to 1
// to ensure that only one operation can be performed at a time.
const BINARY_SEMAPHORE_CONCURRENCY = 1;

export interface FileSystemGraphObjectStoreParams {
  integrationSteps?: IntegrationStep[];
  /**
   * The maximum size in bytes of entities/relationships stored in memory at one time.
   * default: 5_000_000
   */
  graphObjectBufferThresholdInBytes?: number;

  /**
   * The maximum number of entities/relationships stored in each file.
   */
  graphObjectFileSize?: number;

  /**
   * Whether the files that are written to disk should be minified or not
   */
  prettifyFiles?: boolean;
}

interface GraphObjectIndexMetadataMap {
  /**
   * Map of _type to GraphObjectIndexMetadata
   */
  entities: Map<string, GraphObjectIndexMetadata>;
  /**
   * Map of _type to GraphObjectIndexMetadata
   */
  relationships: Map<string, GraphObjectIndexMetadata>;
}

/**
 * TODO: Write this comment to explain why the thing is the way it is
 */
function integrationStepsToGraphObjectIndexMetadataMap(
  integrationSteps: IntegrationStep[],
): Map<string, GraphObjectIndexMetadataMap> {
  const stepIdToGraphObjectIndexMetadataMap = new Map<
    string,
    GraphObjectIndexMetadataMap
  >();

  for (const step of integrationSteps) {
    const metadataMap: GraphObjectIndexMetadataMap = {
      entities: new Map(),
      relationships: new Map(),
    };

    for (const entityMetadata of step.entities) {
      if (entityMetadata.indexMetadata) {
        metadataMap.entities.set(
          entityMetadata._type,
          entityMetadata.indexMetadata,
        );
      }
    }

    for (const relationshipMetadata of step.relationships) {
      if (relationshipMetadata.indexMetadata) {
        metadataMap.relationships.set(
          relationshipMetadata._type,
          relationshipMetadata.indexMetadata,
        );
      }
    }

    stepIdToGraphObjectIndexMetadataMap.set(step.id, metadataMap);
  }

  return stepIdToGraphObjectIndexMetadataMap;
}

/**
 * After entities are flushed from the local in-memory graph object store, most are
 * placed on disk. (With the exception of entities whose metadata includes
 * `{ indexMetadata: { enabled: false }}`).
 *
 * This map allows us to more efficiently retrieve those entities using the `findEntity()` method,
 * using their file path and index.
 */
type GraphObjectLocationOnDisk = {
  graphDataPath: string;
  index: number;
};

const ENTITY_LOCATION_ON_DISK_DEFAULT_MAP_KEY_SPACE = 2000000;

export class FileSystemGraphObjectStore implements GraphObjectStore {
  private readonly semaphore: Sema;
  private readonly localGraphObjectStore = new InMemoryGraphObjectStore();
  private readonly graphObjectFileSize: number;
  private readonly graphObjectBufferThresholdInBytes: number;
  private readonly prettifyFiles: boolean;
  private readonly stepIdToGraphObjectIndexMetadataMap: Map<
    string,
    GraphObjectIndexMetadataMap
  >;
  private readonly entityOnDiskLocationMap = new BigMap<
    string,
    GraphObjectLocationOnDisk
  >(ENTITY_LOCATION_ON_DISK_DEFAULT_MAP_KEY_SPACE);

  constructor(params?: FileSystemGraphObjectStoreParams) {
    this.semaphore = new Sema(BINARY_SEMAPHORE_CONCURRENCY);
    this.graphObjectFileSize =
      params?.graphObjectFileSize || DEFAULT_GRAPH_OBJECT_FILE_SIZE;

    this.prettifyFiles = params?.prettifyFiles || false;
    this.graphObjectBufferThresholdInBytes = min([
      params?.graphObjectBufferThresholdInBytes ||
        DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES,
      MAX_GRAPH_OBJECT_BUFFER_THRESHOLD_IN_BYTES,
    ])!;
    if (params?.integrationSteps) {
      this.stepIdToGraphObjectIndexMetadataMap =
        integrationStepsToGraphObjectIndexMetadataMap(params.integrationSteps);
    }
  }

  async addEntities(
    stepId: string,
    newEntities: Entity[],
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
  ) {
    await this.localGraphObjectStore.addEntities(stepId, newEntities);

    if (
      this.localGraphObjectStore.getTotalEntitySizeInBytes() >=
      this.graphObjectBufferThresholdInBytes
    ) {
      await this.flushEntitiesToDisk(onEntitiesFlushed);
    }
  }

  async addRelationships(
    stepId: string,
    newRelationships: Relationship[],
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
  ) {
    await this.localGraphObjectStore.addRelationships(stepId, newRelationships);

    if (
      this.localGraphObjectStore.getTotalRelationshipSizeInBytes() >=
      this.graphObjectBufferThresholdInBytes
    ) {
      await this.flushRelationshipsToDisk(onRelationshipsFlushed);
    }
  }

  /**
   * The FileSystemGraphObjectStore first checks to see if the entity exists
   * in the InMemoryGraphObjectStore. If not, it then checks to see if it is
   * located on disk.
   */
  async findEntity(_key: string | undefined): Promise<Entity | undefined> {
    if (!_key) return;
    const bufferedEntity = await this.localGraphObjectStore.findEntity(_key);
    if (bufferedEntity) {
      return bufferedEntity;
    }

    const entityLocationOnDisk = this.entityOnDiskLocationMap.get(_key);
    if (!entityLocationOnDisk) return;

    const filePath = getRootStorageAbsolutePath(
      entityLocationOnDisk.graphDataPath,
    );
    const { entities } = await readGraphObjectFile<FlushedEntityData>({
      filePath,
    });
    return entities[entityLocationOnDisk.index];
  }

  async iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
    concurrency?: number,
  ) {
    //TODO: Remove maps. This is a hack we did to avoid returning duplicated entities.
    //This should not work this way.
    //There is a detailed description of the changes to come to avoid having to do this
    //Here: https://jupiterone.atlassian.net/wiki/spaces/INT/pages/786169857/Task+SDK+decouple+tasks
    const iteratedEntities = new Map<string, boolean>();
    await this.localGraphObjectStore.iterateEntities(
      filter,
      (obj: T) => {
        iteratedEntities.set(obj._key, true);
        return iteratee(obj);
      },
      concurrency,
    );

    await iterateEntityTypeIndex({
      type: filter._type,
      concurrency,
      iteratee: (obj: T) => {
        if (iteratedEntities.has(obj._key)) {
          return;
        }
        return iteratee(obj);
      },
    });
  }

  async iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
    concurrency?: number,
  ) {
    //TODO: Remove maps. This is a hack we did to avoid returning duplicated relationships.
    //This should not work this way.
    //There is a detailed description of the changes to come to avoid having to do this
    //Here: https://jupiterone.atlassian.net/wiki/spaces/INT/pages/786169857/Task+SDK+decouple+tasks
    const iteratedRelationships = new Map<string, boolean>();
    await this.localGraphObjectStore.iterateRelationships(filter, (obj: T) => {
      iteratedRelationships.set(obj._key, true);
      return iteratee(obj);
    });

    await iterateRelationshipTypeIndex({
      type: filter._type,
      concurrency,
      iteratee: (obj: T) => {
        if (iteratedRelationships.has(obj._key)) {
          return;
        }
        return iteratee(obj);
      },
    });
  }

  async flush(
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
  ) {
    await Promise.all([
      this.flushEntitiesToDisk(onEntitiesFlushed, true),
      this.flushRelationshipsToDisk(onRelationshipsFlushed, true),
    ]);
  }
  /**
   * Asynchronously flushes entity data to disk.
   *
   * This function ensures that entity data is saved to disk when necessary. It uses a locking mechanism
   * to prevent concurrent modifications and checks if the data size exceeds a certain threshold before flushing.
   *
   * @param {function} [onEntitiesFlushed] - Optional. A callback function that is invoked after the entities
   *                                              have been flushed to disk. It receives an array of entities as
   *                                              an argument and returns a Promise.
   * @param {Boolean} [force=false] - Optional. A boolean flag indicating whether to force the flushing process
   *                                  regardless of the data size threshold.
   *
   * This process ensures efficient and necessary data uploads, avoiding redundant or unnecessary disk operations.
   */
  async flushEntitiesToDisk(
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
    force: Boolean = false,
  ) {
    await this.lockOperation(async () => {
      // This code rechecks the condition that triggers the flushing process to avoid unnecessary uploads
      // During concurrent steps, we might be deleting items from memory while a step is adding new items. This could cause the threshold
      // to be triggered again. By rechecking the condition, we ensure that only necessary uploads occur.
      if (
        !force &&
        this.localGraphObjectStore.getTotalEntitySizeInBytes() <
          this.graphObjectBufferThresholdInBytes
      ) {
        return;
      }

      const entitiesByStep = this.localGraphObjectStore.collectEntitiesByStep();
      let entitiesToUpload: Entity[] = [];
      for (const [stepId, entities] of entitiesByStep) {
        const indexable = entities.filter((e) => {
          const indexMetadata = this.getIndexMetadataForGraphObjectType({
            stepId,
            _type: e._type,
            graphObjectCollectionType: 'entities',
          });

          if (typeof indexMetadata === 'undefined') {
            return true;
          }

          return indexMetadata.enabled === true;
        });

        if (indexable.length) {
          await Promise.all(
            chunk(indexable, this.graphObjectFileSize).map(async (data) => {
              const graphObjectsToFilePaths = await flushDataToDisk({
                storageDirectoryPath: stepId,
                collectionType: 'entities',
                data,
                pretty: this.prettifyFiles,
              });

              for (const {
                graphDataPath,
                collection,
              } of graphObjectsToFilePaths) {
                for (const [index, e] of collection.entries()) {
                  this.entityOnDiskLocationMap.set(e._key, {
                    graphDataPath,
                    index,
                  });
                }
              }
            }),
          );
        }

        this.localGraphObjectStore.flushEntities(entities, stepId);
        entitiesToUpload = entitiesToUpload.concat(entities);
      }

      if (onEntitiesFlushed) {
        await onEntitiesFlushed(entitiesToUpload);
      }
    });
  }
  /**
   * Asynchronously flushes relationship data to disk.
   *
   * This function ensures that relationship data is saved to disk when necessary. It uses a locking mechanism
   * to prevent concurrent modifications and checks if the data size exceeds a certain threshold before flushing.
   *
   * @param {function} [onRelationshipsFlushed] - Optional. A callback function that is invoked after the relationships
   *                                              have been flushed to disk. It receives an array of relationships as
   *                                              an argument and returns a Promise.
   * @param {Boolean} [force=false] - Optional. A boolean flag indicating whether to force the flushing process
   *                                  regardless of the data size threshold.
   *
   * This process ensures efficient and necessary data uploads, avoiding redundant or unnecessary disk operations.
   */
  async flushRelationshipsToDisk(
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
    force: Boolean = false,
  ) {
    await this.lockOperation(async () => {
      // This code rechecks the condition that triggers the flushing process to avoid unnecessary uploads
      // During concurrent steps, we might be deleting items from memory while a step is adding new items. This could cause the threshold
      // to be triggered again. By rechecking the condition, we ensure that only necessary uploads occur.
      if (
        !force &&
        this.localGraphObjectStore.getTotalRelationshipSizeInBytes() <
          this.graphObjectBufferThresholdInBytes
      ) {
        return;
      }
      const relationshipsByStep =
        this.localGraphObjectStore.collectRelationshipsByStep();
      let relationshipsToUpload: Relationship[] = [];
      for (const [stepId, relationships] of relationshipsByStep) {
        const indexable = relationships.filter((r) => {
          const indexMetadata = this.getIndexMetadataForGraphObjectType({
            stepId,
            _type: r._type,
            graphObjectCollectionType: 'relationships',
          });

          if (typeof indexMetadata === 'undefined') {
            return true;
          }

          return indexMetadata.enabled === true;
        });

        if (indexable.length) {
          await Promise.all(
            chunk(indexable, this.graphObjectFileSize).map(async (data) => {
              await flushDataToDisk({
                storageDirectoryPath: stepId,
                collectionType: 'relationships',
                data,
                pretty: this.prettifyFiles,
              });
            }),
          );
        }

        this.localGraphObjectStore.flushRelationships(relationships, stepId);
        relationshipsToUpload = relationshipsToUpload.concat(relationships);
      }

      if (onRelationshipsFlushed) {
        await onRelationshipsFlushed(relationshipsToUpload);
      }
    });
  }

  getIndexMetadataForGraphObjectType({
    stepId,
    _type,
    graphObjectCollectionType,
  }: GetIndexMetadataForGraphObjectTypeParams):
    | GraphObjectIndexMetadata
    | undefined {
    if (!this.stepIdToGraphObjectIndexMetadataMap) {
      return undefined;
    }

    const map = this.stepIdToGraphObjectIndexMetadataMap.get(stepId);
    return map && map[graphObjectCollectionType].get(_type);
  }

  /**
   * This function is ensures that only one input operation can
   * happen at a time by utilizing a binary semaphore (lock/unlock).
   *
   * This is used by `flushEntitiesToDisk` and
   * `flushRelationshipsToDisk` to ensure that consumers of this
   * object store wait until all of the currently staged data has been
   * written to disk.
   *
   * Waiting for all data to be flushed is important for
   * maintaining step execution order when
   * flushing data via the `jobState` object.
   *
   * Without some sort of locking mechanism, one step (let's say, step A)
   * could have another step (step B) begin the work of flushing
   * it's data to disk. To prevent duplicate data from being flushed,
   * step B's flush would "claim" the data to write and remove it from
   * the in memory store. Step A would see that there's no work to do
   * and prematurely end, causing the next step to start up before the
   * data it depends on is present on disk.
   */
  private async lockOperation<T>(operation: () => Promise<T>) {
    await this.semaphore.acquire();
    try {
      await operation();
    } finally {
      this.semaphore.release();
    }
  }
}
