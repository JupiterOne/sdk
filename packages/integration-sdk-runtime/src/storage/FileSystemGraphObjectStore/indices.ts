import {
  Entity,
  Relationship,
  GraphObjectIteratee,
  IntegrationError,
} from '@jupiterone/integration-sdk-core';

import { walkDirectory, WalkDirectoryIterateeInput } from '../../fileSystem';

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
      const object = parseData(input);
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
      const object = parseData(input);
      if (isObjectFlushedRelationshipData(object)) {
        for (const relationship of object.relationships as T[]) {
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
    throw new IntegrationError({
      code: 'INVALID_DATA_JSON',
      message: `Failed to parse JSON in '${filePath}'`,
    });
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
