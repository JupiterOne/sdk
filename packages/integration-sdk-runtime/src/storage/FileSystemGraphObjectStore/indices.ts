import {
  Entity,
  Relationship,
  GraphObjectIteratee,
  IntegrationError,
} from '@jupiterone/integration-sdk-core';
import { readJsonFromPath, WalkDirectoryIterateeInput } from '../../fileSystem';

import { buildIndexDirectoryPath } from './path';
import { iterateParsedGraphFiles } from '../..';
import PQueue from 'p-queue';
import { onQueueSizeIsLessThanLimit } from '../queue';

interface BaseIterateCollectionIndexParams<GraphObject> {
  type: string;
  iteratee: GraphObjectIteratee<GraphObject>;
}

interface IterateCollectionIndexParams<GraphObject>
  extends BaseIterateCollectionIndexParams<GraphObject> {
  collectionType: 'entities' | 'relationships';
  options?: { concurrency: number };
}

async function iterateCollectionTypeIndex<T extends Entity | Relationship>({
  type,
  collectionType,
  iteratee,
  options,
}: IterateCollectionIndexParams<T>) {
  const path = buildIndexDirectoryPath({
    collectionType,
    type,
  });

  const queue = new PQueue({});
  const concurrency = options?.concurrency ?? 1;

  await iterateParsedGraphFiles(async (data) => {
    for (const graphObj of (data[collectionType] as T[]) || []) {
      // We mark this as void because we want to fire the task away and not wait for it to resolve
      // that is handled by the combination of onQueueSizeIsLessThanLimit and onIdle
      void queue.add(() => iteratee(graphObj));
      await onQueueSizeIsLessThanLimit(queue, concurrency);
    }
  }, path);

  // Wait for all tasks to complete
  await queue.onIdle();
}

export async function iterateEntityTypeIndex<T extends Entity = Entity>({
  type,
  iteratee,
}: BaseIterateCollectionIndexParams<T>) {
  await iterateCollectionTypeIndex({
    type,
    iteratee,
    collectionType: 'entities',
  });
}

export async function iterateRelationshipTypeIndex<
  T extends Relationship = Relationship,
>({ type, iteratee }: BaseIterateCollectionIndexParams<T>) {
  await iterateCollectionTypeIndex({
    type,
    iteratee,
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
