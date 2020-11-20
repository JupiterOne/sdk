import {
  Entity,
  Relationship,
  GraphObjectIteratee,
  IntegrationError,
} from '@jupiterone/integration-sdk-core';
import { FlushedEntityData, FlushedRelationshipData } from '../types';
import {
  readJsonFromPath,
  walkDirectory,
  WalkDirectoryIterateeInput,
} from '../../fileSystem';

import { buildIndexDirectoryPath } from './path';

interface IterateIndexInput<GraphObject> {
  type: string;
  iteratee: GraphObjectIteratee<GraphObject>;
}

export async function iterateEntityTypeIndex<T extends Entity = Entity>({
  type,
  iteratee,
}: IterateIndexInput<T>) {
  const path = buildIndexDirectoryPath({
    collectionType: 'entities',
    type,
  });

  await walkDirectory({
    path,
    iteratee: async (input) => {
      const object = await readGraphObjectFile<FlushedEntityData>(input);
      if (isObjectFlushedEntityData(object)) {
        for (const entity of object.entities as T[]) {
          await iteratee(entity);
        }
      }
    },
  });
}

export async function iterateRelationshipTypeIndex<
  T extends Relationship = Relationship
>({ type, iteratee }: IterateIndexInput<T>) {
  const path = buildIndexDirectoryPath({
    collectionType: 'relationships',
    type,
  });

  await walkDirectory({
    path,
    iteratee: async (input) => {
      const object = await readGraphObjectFile<FlushedRelationshipData>(input);
      if (isObjectFlushedRelationshipData(object)) {
        for (const relationship of object.relationships as T[]) {
          await iteratee(relationship);
        }
      }
    },
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

function isObjectFlushedEntityData(object: any): object is FlushedEntityData {
  return Array.isArray(object?.entities);
}

function isObjectFlushedRelationshipData(
  object: any,
): object is FlushedRelationshipData {
  return Array.isArray(object?.relationships);
}
