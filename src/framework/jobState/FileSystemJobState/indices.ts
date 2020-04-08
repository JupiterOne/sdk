import { Entity, Relationship } from '../../types';
import { GraphObjectIteratee } from '../types';

import {
  walkDirectory,
  WalkDirectoryIterateeInput,
} from '../../../cacheDirectory';

import { buildIndexDirectoryPath } from './path';

interface IterateIndexInput<GraphObject> {
  cacheDirectory?: string;
  type: string;
  iteratee: GraphObjectIteratee<GraphObject>;
}

export async function iterateEntityTypeIndex({
  cacheDirectory,
  type,
  iteratee,
}: IterateIndexInput<Entity>) {
  const path = buildIndexDirectoryPath({
    collectionType: 'entities',
    type,
  });

  await walkDirectory({
    cacheDirectory,
    path,
    iteratee: async (input) => {
      const object = parseData(input);
      if (isObjectFlushedEntityData(object)) {
        for (const entity of object.entities) {
          await iteratee(entity);
        }
      }
    },
  });
}

export async function iterateRelationshipTypeIndex({
  cacheDirectory,
  type,
  iteratee,
}: IterateIndexInput<Relationship>) {
  const path = buildIndexDirectoryPath({
    collectionType: 'relationships',
    type,
  });

  await walkDirectory({
    cacheDirectory,
    path,
    iteratee: async (input) => {
      const object = parseData(input);
      if (isObjectFlushedRelationshipData(object)) {
        for (const relationship of object.relationships) {
          await iteratee(relationship);
        }
      }
    },
  });
}

function parseData({ filePath, data }: WalkDirectoryIterateeInput): object {
  try {
    return JSON.parse(data);
  } catch (err) {
    throw new Error(`Failed to parse JSON in '${filePath}'`);
  }
}

interface FlushedEntityData {
  entities: Entity[];
}

function isObjectFlushedEntityData(object: any): object is FlushedEntityData {
  return Array.isArray(object?.entities);
}

interface FlushedRelationshipData {
  relationships: Relationship[];
}

function isObjectFlushedRelationshipData(
  object: any,
): object is FlushedRelationshipData {
  return Array.isArray(object?.relationships);
}
