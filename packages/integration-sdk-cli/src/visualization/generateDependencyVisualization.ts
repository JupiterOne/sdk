import { writeFileToPath } from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';
import * as path from 'path';

import { generateVisHTML } from '../utils/generateVisHTML';

import type { Node, Edge } from 'vis';

// Color list to denote which steps have more direct dependencies.
// Starting from cooler colors to warmer colors.
const colorList = ['cyan', 'lime', 'yellow', 'orange', 'red'];

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

  const nodeDataSets: Node[] = [];
  const explicitEdgeDataSets: Edge[] = [];
  for (const step of config.integrationSteps) {
    const dependencyCount = step.dependsOn ? step.dependsOn.length : 0;
    nodeDataSets.push({
      id: step.id,
      label: step.name,
      color: colorList[Math.min(dependencyCount, colorList.length - 1)],
    });
    if (step.dependsOn) {
      for (const dependency of step.dependsOn) {
        explicitEdgeDataSets.push({
          from: dependency,
          to: step.id,
          color: 'black',
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
