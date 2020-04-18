import path from 'path';
import * as nodeFs from 'fs';
const fs = nodeFs.promises;
import { getRootStorageDirectory } from '../../fileSystem';
import { generateVizTemplate } from './generateVizTemplate';
import { retrieveIntegrationData } from './retrieveIntegrationData';

/**
 * Generates visualization of Vertices and Edges using https://visjs.github.io/vis-network/docs/network/
 */
export async function generateVisualization(): Promise<string> {
  const integrationPath = getRootStorageDirectory();

  const { entities, relationships } = await retrieveIntegrationData(
    integrationPath,
  );

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
