import path from 'path';
import { getRootStorageDirectory, writeFileToPath } from '../../fileSystem';
import { generateVizHTML } from './generateVizHTML';
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

  const htmlFile = 'index.html';

  await writeFileToPath({
    path: htmlFile,
    content: generateVizHTML(nodeDataSets, edgeDataSets),
  });

  return path.join(getRootStorageDirectory(), htmlFile);
}
