import path from 'path';
import { writeFileToPath } from '@jupiterone/integration-sdk-runtime';

import { retrieveIntegrationData } from './retrieveIntegrationData';
import { generateVisHTML } from './generateVisHTML';
import { Edge } from 'vis';
import globby from 'globby';
import upath from 'upath';

import * as log from '../log';
import { createMappedRelationshipNodesAndEdges } from './createMappedRelationshipNodesAndEdges';
import { getNodeIdFromEntity } from './utils';

/**
 * Generates visualization of Vertices and Edges using https://visjs.github.io/vis-network/docs/network/
 */
export async function generateVisualization(
  integrationPath: string,
): Promise<string> {
  const resolvedIntegrationPath = path.resolve(process.cwd(), integrationPath);

  const entitiesAndRelationshipPaths = await globby([
    upath.toUnix(`${resolvedIntegrationPath}/**/*.json`),
  ]);

  if (entitiesAndRelationshipPaths.length === 0) {
    log.warn(`Unable to find any files under path: ${resolvedIntegrationPath}`);
  }

  const { entities, relationships, mappedRelationships } = await retrieveIntegrationData(
    entitiesAndRelationshipPaths,
  );

  const nodeDataSets = entities.map((entity) => ({
    id: getNodeIdFromEntity(entity, []),
    label: `${entity.displayName}\n[${entity._type}]`,
    group: entity._type,
  }));
  const explicitEdgeDataSets = relationships.map(
    (relationship): Edge => ({
      from: relationship._fromEntityKey,
      to: relationship._toEntityKey,
      label: relationship.displayName,
    }),
  );

  const {
    mappedRelationshipEdges, 
    mappedRelationshipNodes,
  } = createMappedRelationshipNodesAndEdges({
    mappedRelationships, 
    explicitEntities: entities,
  });

  const htmlFileLocation = path.join(resolvedIntegrationPath, 'index.html');

  await writeFileToPath({
    path: htmlFileLocation,
    content: generateVisHTML([...nodeDataSets, ...mappedRelationshipNodes], [...explicitEdgeDataSets, ...mappedRelationshipEdges]),
  });

  return htmlFileLocation;
}
