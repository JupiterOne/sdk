import pMap from 'p-map';
import { v4 as uuid } from 'uuid';
import groupBy from 'lodash/groupBy';

import { writeJsonToPath, symlink } from '../../../cacheDirectory';

import { Entity, Relationship } from '../../types';

export type CollectionType = 'entities' | 'relationships';

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
      const graphDataPath = buildStepDataPath({
        step,
        collectionType,
        filename,
      });
      const indexPath = buildIndexPath({ type, collectionType, filename });

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

interface BuildStepDataPathInput {
  step: string;
  collectionType: CollectionType;
  filename: string;
}
function buildStepDataPath({
  step,
  collectionType,
  filename,
}: BuildStepDataPathInput) {
  return ['graph', step, collectionType, filename].join('/');
}

interface BuildIndexPathInput {
  collectionType: CollectionType;
  type: string;
  filename: string;
}
function buildIndexPath({
  collectionType,
  type,
  filename,
}: BuildIndexPathInput) {
  return ['index', collectionType, type, filename].join('/');
}
