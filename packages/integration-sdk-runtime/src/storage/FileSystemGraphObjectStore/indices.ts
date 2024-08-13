import {
  Entity,
  Relationship,
  GraphObjectIteratee,
  IntegrationError,
} from '@jupiterone/integration-sdk-core';
import { readJsonFromPath, WalkDirectoryIterateeInput } from '../../fileSystem';

import { buildIndexDirectoryPath } from './path';
import { iterateParsedGraphFiles } from '../..';
import pMap from 'p-map';

interface BaseIterateCollectionIndexParams<GraphObject> {
  type: string;
  iteratee: GraphObjectIteratee<GraphObject>;
  concurrency?: number;
}

interface IterateCollectionIndexParams<GraphObject>
  extends BaseIterateCollectionIndexParams<GraphObject> {
  collectionType: 'entities' | 'relationships';
}

/**
 * Iterates through graph files.
 * If concurrency is specified, it'll process the graph objects concurrently.
 * @param type
 * @param collectionType
 * @param concurrency
 * @param iteratee
 */
async function iterateCollectionTypeIndex<T extends Entity | Relationship>({
  type,
  collectionType,
  concurrency,
  iteratee,
}: IterateCollectionIndexParams<T>) {
  const path = buildIndexDirectoryPath({
    collectionType,
    type,
  });

  await iterateParsedGraphFiles(async (data) => {
    await pMap(
      (data[collectionType] as T[]) || [],
      (graphObj) => iteratee(graphObj),
      { concurrency: concurrency ?? 1 },
    );
  }, path);
}

export async function iterateEntityTypeIndex<T extends Entity = Entity>({
  type,
  iteratee,
  concurrency,
}: BaseIterateCollectionIndexParams<T>) {
  await iterateCollectionTypeIndex({
    type,
    iteratee,
    concurrency,
    collectionType: 'entities',
  });
}

export async function iterateRelationshipTypeIndex<
  T extends Relationship = Relationship,
>({ type, iteratee, concurrency }: BaseIterateCollectionIndexParams<T>) {
  await iterateCollectionTypeIndex({
    type,
    iteratee,
    concurrency,
    collectionType: 'relationships',
  });
}

export async function readGraphObjectFile<T>({
  filePath,
}: WalkDirectoryIterateeInput): Promise<T> {
  try {
    const fileData = await readJsonFromPath<T>(filePath);
    return fileData;
  } catch (err) {
    throw new IntegrationError({
      code: 'INVALID_FILE_DATA',
      message: `Failed to read integration file at '${filePath}'`,
      cause: err,
    });
  }
}
