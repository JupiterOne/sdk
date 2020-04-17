import globby from 'globby';
import path from 'path';
import * as nodeFs from 'fs';
const fs = nodeFs.promises;
import { getRootStorageDirectory, readJsonFile } from '../../fileSystem';
import { Relationship, Entity } from '../types';
import { generateVizTemplate } from './generateVizTemplate';

/**
 * Generates visualization of Vertices and Edges using https://visjs.github.io/vis-network/docs/network/
 */
export async function generateVisualization(): Promise<string> {
  const integrationPath = getRootStorageDirectory();

  const [entityPaths, relationshipPaths] = await Promise.all([
    globby([path.posix.join(integrationPath, 'index', 'entities')]),
    globby([path.posix.join(integrationPath, 'index', 'relationships')]),
  ]);

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

  const nodeDataSets = entities.map((entity) => ({
    id: entity._key,
    label: entity.name.toString(),
  }));
  const edgeDataSets = relationships.map((relationship) => ({
    from: relationship._fromEntityKey.toString(),
    to: relationship._toEntityKey.toString(),
    label: relationship.displayName.toString(),
  }));

  const htmlPath = path.join(integrationPath, 'index.html');

  await fs.writeFile(
    htmlPath,
    generateVizTemplate(nodeDataSets, edgeDataSets),
    'utf8',
  );

  return htmlPath;
}
