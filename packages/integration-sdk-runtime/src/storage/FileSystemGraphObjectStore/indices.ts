import {
  Entity,
  Relationship,
  GraphObjectIteratee,
  IntegrationError,
} from '@jupiterone/integration-sdk-core';
import { readJsonFromPath, WalkDirectoryIterateeInput } from '../../fileSystem';

import { buildIndexDirectoryPath } from './path';
import { iterateParsedGraphFiles } from '../..';

interface IterateIndexInput<GraphObject> {
  type: string;
  iteratee: GraphObjectIteratee<GraphObject>;
}

interface BaseIterateIndexInput<GraphObject>
  extends IterateIndexInput<GraphObject> {
  collectionType: 'entities' | 'relationships';
}

async function iterateTypeIndex<T extends Entity | Relationship>({
  type,
  collectionType,
  iteratee,
}: BaseIterateIndexInput<T>) {
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
}: IterateIndexInput<T>) {
  await iterateTypeIndex({ type, iteratee, collectionType: 'entities' });
}

export async function iterateRelationshipTypeIndex<
  T extends Relationship = Relationship
>({ type, iteratee }: IterateIndexInput<T>) {
  await iterateTypeIndex({ type, iteratee, collectionType: 'relationships' });
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
