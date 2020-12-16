import { Sema } from 'async-sema';
import pMap from 'p-map';

import {
  Entity,
  GraphObjectFilter,
  GraphObjectIteratee,
  GraphObjectLookupKey,
  IntegrationDuplicateKeyError,
  IntegrationMissingKeyError,
  Relationship,
  GraphObjectStore,
} from '@jupiterone/integration-sdk-core';

import { flushDataToDisk } from './flushDataToDisk';
import {
  iterateEntityTypeIndex,
  iterateRelationshipTypeIndex,
} from './indices';
import { InMemoryGraphObjectStore } from '../memory';

export const DEFAULT_GRAPH_OBJECT_BUFFER_THRESHOLD = 500;

// it is important that this value is set to 1
// to ensure that only one operation can be performed at a time.
const BINARY_SEMAPHORE_CONCURRENCY = 1;

export interface FileSystemGraphObjectStoreParams {
  /**
   * The maximum number of graph objects that this store can buffer in memory
   * before writing to disk. Machines with more memory should consider bumping
   * this value up.
   *
   * Default: 500
   */
  graphObjectBufferThreshold?: number;

  /**
   * Whether the files that are written to disk should be minified or not
   */
  prettifyFiles?: boolean;
}

export class FileSystemGraphObjectStore implements GraphObjectStore {
  private readonly semaphore: Sema;
  private readonly localGraphObjectStore = new InMemoryGraphObjectStore();
  private readonly graphObjectBufferThreshold: number;
  private readonly prettifyFiles: boolean;

  constructor(params?: FileSystemGraphObjectStoreParams) {
    this.semaphore = new Sema(BINARY_SEMAPHORE_CONCURRENCY);
    this.graphObjectBufferThreshold =
      params?.graphObjectBufferThreshold ||
      DEFAULT_GRAPH_OBJECT_BUFFER_THRESHOLD;
    this.prettifyFiles = params?.prettifyFiles || false;
  }

  async addEntities(
    storageDirectoryPath: string,
    newEntities: Entity[],
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
  ) {
    this.localGraphObjectStore.addEntities(storageDirectoryPath, newEntities);

    if (
      this.localGraphObjectStore.getTotalEntityItemCount() >=
      this.graphObjectBufferThreshold
    ) {
      await this.flushEntitiesToDisk(onEntitiesFlushed);
    }
  }

  async addRelationships(
    storageDirectoryPath: string,
    newRelationships: Relationship[],
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
  ) {
    this.localGraphObjectStore.addRelationships(
      storageDirectoryPath,
      newRelationships,
    );

    if (
      this.localGraphObjectStore.getTotalRelationshipItemCount() >=
      this.graphObjectBufferThreshold
    ) {
      await this.flushRelationshipsToDisk(onRelationshipsFlushed);
    }
  }

  async getEntity({ _key, _type }: GraphObjectLookupKey): Promise<Entity> {
    const bufferedEntity = this.localGraphObjectStore.findEntity(_key);

    if (bufferedEntity) {
      // This entity has not yet been flushed to disk
      return bufferedEntity;
    }

    const entities: Entity[] = [];

    await this.iterateEntities({ _type }, async (e) => {
      if (e._key === _key) {
        entities.push(e);
      }

      return Promise.resolve();
    });

    if (entities.length === 0) {
      throw new IntegrationMissingKeyError(
        `Failed to find entity (_type=${_type}, _key=${_key})`,
      );
    } else if (entities.length > 1) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_type=${_type}, _key=${_key})`,
      );
    } else {
      return entities[0];
    }
  }

  async iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ) {
    await this.localGraphObjectStore.iterateEntities(filter, iteratee);

    await iterateEntityTypeIndex({
      type: filter._type,
      iteratee,
    });
  }

  async iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ) {
    await this.localGraphObjectStore.iterateRelationships(filter, iteratee);

    await iterateRelationshipTypeIndex({
      type: filter._type,
      iteratee,
    });
  }

  async flush(
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
  ) {
    await Promise.all([
      this.flushEntitiesToDisk(onEntitiesFlushed),
      this.flushRelationshipsToDisk(onRelationshipsFlushed),
    ]);
  }

  async flushEntitiesToDisk(
    onEntitiesFlushed?: (entities: Entity[]) => Promise<void>,
  ) {
    await this.lockOperation(() =>
      pMap(
        this.localGraphObjectStore.collectEntitiesByStep(),
        async ([stepId, entities]) => {
          await flushDataToDisk({
            storageDirectoryPath: stepId,
            collectionType: 'entities',
            data: entities,
            pretty: this.prettifyFiles,
          });

          this.localGraphObjectStore.flushEntities(entities);

          if (onEntitiesFlushed) {
            await onEntitiesFlushed(entities);
          }
        },
      ),
    );
  }

  async flushRelationshipsToDisk(
    onRelationshipsFlushed?: (relationships: Relationship[]) => Promise<void>,
  ) {
    await this.lockOperation(() =>
      pMap(
        this.localGraphObjectStore.collectRelationshipsByStep(),
        async ([stepId, relationships]) => {
          await flushDataToDisk({
            storageDirectoryPath: stepId,
            collectionType: 'relationships',
            data: relationships,
            pretty: this.prettifyFiles,
          });

          this.localGraphObjectStore.flushRelationships(relationships);

          if (onRelationshipsFlushed) {
            await onRelationshipsFlushed(relationships);
          }
        },
      ),
    );
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
