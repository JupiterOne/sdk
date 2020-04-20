import globby from 'globby';
import upath from 'upath';

import { Relationship, Entity } from '../types';
import { readJsonFile } from '../../fileSystem';
import { IntegrationData } from './types/IntegrationData';
import { IntegrationMissingCollectJSON } from './error';

/**
 * Retrieve integration data from the JSON files from the cache directory
 */
export async function retrieveIntegrationData(
  integrationPath: string,
): Promise<IntegrationData> {
  const [entityPaths, relationshipPaths] = await Promise.all([
    globby([upath.toUnix(`${integrationPath}/index/entities/**/*.json`)]),
    globby([upath.toUnix(`${integrationPath}/index/relationships/**/*.json`)]),
  ]);

  if (entityPaths.length === 0 && relationshipPaths.length === 0) {
    throw new IntegrationMissingCollectJSON(
      'Unable to find any entities or relationships, have you run the "j1-integration collect" command',
    );
  }

  const entities: Entity[] = [];
  const relationships: Relationship[] = [];

  for (const path of entityPaths) {
    const parsedEntities = await readJsonFile<{ entities: Entity[] }>(path);
    entities.push(...parsedEntities.entities);
  }

  for (const path of relationshipPaths) {
    const parsedRelationships = await readJsonFile<{
      relationships: Relationship[];
    }>(path);
    relationships.push(...parsedRelationships.relationships);
  }

  return {
    entities,
    relationships,
  };
}
