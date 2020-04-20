import { createCommand } from 'commander';

import * as log from '../../log';

import { generateVisualization } from '../../framework';

export function visualize() {
  return createCommand('visualize')
    .description('Visualizes the collected data as a graph')
    .action(async () => {
      const graph = await generateVisualization();
      log.info(`Visualize graph here: ${graph}`);
    });
}
