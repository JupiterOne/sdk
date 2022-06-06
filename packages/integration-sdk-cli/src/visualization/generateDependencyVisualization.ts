import { writeFileToPath } from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';
import * as path from 'path';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';

import { generateVisHTML } from '../utils/generateVisHTML';

/**
 * Generate a graph visualization of steps and their dependencies.
 * https://visjs.github.io/vis-network/docs/network/.
 *
 * @param graphDataPath path to directory of collected entities and relationships
 * @param visualizationOutputPath path to output HTML file
 */
export async function generateDependencyVisualization(
  graphDataPath: string,
  visualizationOutputPath: string,
): Promise<void> {
  const config = await loadConfig(path.join(graphDataPath, 'src'));
  const stepDependencyGraph = buildStepDependencyGraph(config.integrationSteps);

  const nodeDataSets: any = [];
  const explicitEdgeDataSets: any = [];
  for ( const step of Object.values<any>(stepDependencyGraph['nodes'])) {
    nodeDataSets.push({
      id: step.id,
      label: step.name
    });
    if(step['dependsOn']) {
      for ( const dependency of step['dependsOn']) {
        explicitEdgeDataSets.push({
          from: step.id,
          to: dependency,
        });
      }
    }
  }

  await writeFileToPath({
    path: visualizationOutputPath,
    content: generateVisHTML(
      graphDataPath,
      [...nodeDataSets],
      [...explicitEdgeDataSets],
    ),
  });
}
