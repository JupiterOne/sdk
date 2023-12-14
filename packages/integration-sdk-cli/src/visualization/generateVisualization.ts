import globby from 'globby';
import upath from 'upath';
import type { Edge } from 'vis';

import { writeFileToPath } from '@jupiterone/integration-sdk-runtime';

import * as log from '../log';
import { generateVisHTML } from '../utils/generateVisHTML';
import { createMappedRelationshipNodesAndEdges } from './createMappedRelationshipNodesAndEdges';
import { retrieveIntegrationData } from './retrieveIntegrationData';
import { getNodeIdFromEntity } from './utils';

/**
 * Generate a graph visualization of collected entities and relationships using
 * https://visjs.github.io/vis-network/docs/network/.
 *
 * @param graphDataPath path to directory of collected entities and relationships
 */
export async function generateVisualization(
  graphDataPath: string,
  visualizationOutputPath: string,
): Promise<void> {
  const entitiesAndRelationshipPaths = await globby([
    upath.toUnix(`${graphDataPath}/**/*.json`),
  ]);

  if (entitiesAndRelationshipPaths.length === 0) {
    log.warn(`Unable to find any files under path: ${graphDataPath}`);
  }

  const { entities, relationships, mappedRelationships } =
    await retrieveIntegrationData(entitiesAndRelationshipPaths);

  const nodeDataSets = entities.map((entity) => ({
    id: getNodeIdFromEntity(entity, []),
    label: `${entity.displayName}\n[${entity._type}]${entity.region ? ` - ${entity.region}`: ''}\n${entity._key}`,
    group: entity._type,
  }));
  const explicitEdgeDataSets = relationships.map(
    (relationship): Edge => ({
      from: relationship._fromEntityKey,
      to: relationship._toEntityKey,
      label: relationship.displayName,
    }),
  );

  const { mappedRelationshipEdges, mappedRelationshipNodes } =
    createMappedRelationshipNodesAndEdges({
      mappedRelationships,
      explicitEntities: entities,
    });

  await writeFileToPath({
    path: visualizationOutputPath,
    content: generateVisHTML(
      graphDataPath,
      [...nodeDataSets, ...mappedRelationshipNodes],
      [...explicitEdgeDataSets, ...mappedRelationshipEdges],
    ),
  });
}
