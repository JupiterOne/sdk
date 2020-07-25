import { Entity, ExplicitRelationship, MappedRelationship } from '@jupiterone/integration-sdk-core';
import { readJsonFromPath } from '@jupiterone/integration-sdk-runtime';
import { IntegrationData } from './types/IntegrationData';

/**
 * Retrieve integration data from the JSON files from the specified path, defaults to .j1-integration/graph
 */
export async function retrieveIntegrationData(
  entitiesAndRelationshipPaths: string[],
): Promise<IntegrationData> {
  const entities: Entity[] = [];
  const explicitRelationships: ExplicitRelationship[] = [];
  const mappedRelationships: MappedRelationship[] = [];

  const entitiesAndRelationships = await Promise.all(
    entitiesAndRelationshipPaths.map(
      async (path): Promise<any> => {
        return await readJsonFromPath<any>(path);
      },
    ),
  );

  for (const item of entitiesAndRelationships) {
    if (typeof item === 'object') {
      if (item.entities && Array.isArray(item.entities)) {
        entities.push(...item.entities);
      }

      if (item.relationships && Array.isArray(item.relationships)) {
        for (const relationship of item.relationships) {
          if (typeof relationship === 'object' && !relationship._mapping) {
            explicitRelationships.push(relationship);
          } else {
            mappedRelationships.push(relationship);
          }
        }
      }
    }
  }

  return {
    entities,
    relationships: explicitRelationships,
    mappedRelationships,
  };
}
