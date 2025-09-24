import pMap from 'p-map';
import { randomUUID as uuid } from 'crypto';
import groupBy from 'lodash/groupBy';

import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

import { writeJsonToPath, symlink } from '../../fileSystem';

import {
  CollectionType,
  buildIndexFilePath,
  buildObjectCollectionFilePath,
} from './path';

interface FlushDataToDiskInput<TGraphObject = Entity | Relationship> {
  storageDirectoryPath: string;
  collectionType: CollectionType;
  data: TGraphObject[];
  pretty?: boolean;
  logger?: any;
}

interface GraphObjectToFilePath<TGraphObject = Entity | Relationship> {
  graphDataPath: string;
  collection: TGraphObject[];
}

/**
 * Utility for flushing collected data to disk and
 * creating a symlink in the 'index' directory
 * based on the entity or relationship '_type'.
 */
export async function flushDataToDisk<TGraphObject = Entity | Relationship>({
  storageDirectoryPath,
  collectionType,
  data,
  pretty,
  logger,
}: FlushDataToDiskInput<TGraphObject>): Promise<
  GraphObjectToFilePath<TGraphObject>[]
> {
  // split the data by type first
  const groupedCollections = groupBy(data, '_type');

  const totalObjects = data.length;
  const typeCount = Object.keys(groupedCollections).length;
  const chunkInfo = Object.entries(groupedCollections)
    .map(([type, items]) => `${type}:${items.length}`)
    .join(', ');

  logger?.debug(
    {
      stepId: storageDirectoryPath,
      collectionType,
      totalObjects,
      typeCount,
      chunkInfo,
    },
    'Flushing data to disk',
  );

  // for each collection, write the data to disk,
  // then symlink to index directory
  const results = await pMap(
    Object.entries(groupedCollections),
    async ([type, collection]) => {
      const filename = generateJsonFilename();
      const graphDataPath = buildObjectCollectionFilePath({
        storageDirectoryPath,
        collectionType,
        filename,
      });
      const indexPath = buildIndexFilePath({ type, collectionType, filename });

      try {
        await writeJsonToPath({
          path: graphDataPath,
          data: {
            [collectionType]: collection,
          },
          pretty,
        });

        await symlink({
          sourcePath: graphDataPath,
          destinationPath: indexPath,
        });

        logger?.debug(
          {
            type,
            count: collection.length,
            filename,
            graphDataPath,
          },
          'Chunk written to disk successfully',
        );

        return {
          graphDataPath,
          collection,
        };
      } catch (error) {
        logger?.error(
          {
            error,
            type,
            count: collection.length,
            filename,
            graphDataPath,
          },
          'Failed to write chunk to disk',
        );
        throw error;
      }
    },
    { concurrency: 3 },
  );

  logger?.info(
    {
      stepId: storageDirectoryPath,
      collectionType,
      chunksWritten: results.length,
      totalObjectsWritten: results.reduce(
        (sum, r) => sum + r.collection.length,
        0,
      ),
    },
    'Successfully flushed all chunks to disk',
  );

  return results;
}

function generateJsonFilename() {
  return `${uuid()}.json`;
}
