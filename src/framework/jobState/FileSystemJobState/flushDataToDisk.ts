import pMap from 'p-map';
import { v4 as uuid } from 'uuid';
import groupBy from 'lodash/groupBy';

import { writeJsonToPath, symlink } from '../../../cacheDirectory';

import { Entity, Relationship } from '../../types';
import {
  CollectionType,
  buildIndexFilePath,
  buildStepCollectionFilePath,
} from './path';

interface FlushDataToDiskInput {
  cacheDirectory?: string;
  step: string;
  collectionType: CollectionType;
  data: Entity[] | Relationship[];
}

/**
 * Utility for flushing collected data to disk and
 * creating a symlink in the 'index' directory
 * based on the entity or relationship '_type'.
 */
export async function flushDataToDisk({
  cacheDirectory,
  step,
  collectionType,
  data,
}: FlushDataToDiskInput) {
  // split the data by type first
  const groupedCollections = groupBy(data, '_type');

  // for each collection, write the data to disk,
  // then symlink to index directory
  await pMap(
    Object.entries(groupedCollections),
    async ([type, collection]) => {
      const filename = generateJsonFilename();
      const graphDataPath = buildStepCollectionFilePath({
        step,
        collectionType,
        filename,
      });
      const indexPath = buildIndexFilePath({ type, collectionType, filename });

      await writeJsonToPath({
        cacheDirectory,
        path: graphDataPath,
        data: {
          [collectionType]: collection,
        },
      });

      await symlink({
        cacheDirectory,
        sourcePath: graphDataPath,
        destinationPath: indexPath,
      });
    },
    { concurrency: 3 },
  );
}

function generateJsonFilename() {
  return `${uuid()}.json`;
}
