import {
  Entity,
  Relationship,
  GraphObjectIteratee,
  IntegrationError,
} from '@jupiterone/integration-sdk-core';
import { readJsonFromPath, WalkDirectoryIterateeInput } from '../../fileSystem';

import { buildIndexDirectoryPath } from './path';
import { iterateParsedGraphFiles } from '../..';

interface BaseIterateCollectionIndexParams<GraphObject> {
  type: string;
  iteratee: GraphObjectIteratee<GraphObject>;
}

interface IterateCollectionIndexParams<GraphObject>
  extends BaseIterateCollectionIndexParams<GraphObject> {
  collectionType: 'entities' | 'relationships';
}

async function iterateCollectionTypeIndex<T extends Entity | Relationship>({
  type,
  collectionType,
  iteratee,
}: IterateCollectionIndexParams<T>) {
  const path = buildIndexDirectoryPath({
    collectionType,
    type,
  });

  await iterateParsedGraphFiles(async (data) => {
    for (const graphObj of (data[collectionType] as T[]) || []) {
      await iteratee(graphObj);
    }
  }, path);
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
