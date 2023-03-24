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
}: FlushDataToDiskInput<TGraphObject>): Promise<
  GraphObjectToFilePath<TGraphObject>[]
> {
  // split the data by type first
  const groupedCollections = groupBy(data, '_type');

  // for each collection, write the data to disk,
  // then symlink to index directory
  return await pMap(
    Object.entries(groupedCollections),
    async ([type, collection]) => {
      const filename = generateJsonFilename();
      const graphDataPath = buildObjectCollectionFilePath({
        storageDirectoryPath,
        collectionType,
        filename,
      });
      const indexPath = buildIndexFilePath({ type, collectionType, filename });

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
      return {
        graphDataPath,
        collection,
      };
    },
    { concurrency: 3 },
  );
}

function generateJsonFilename() {
  return `${uuid()}.json`;
}
