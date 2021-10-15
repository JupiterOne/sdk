import { createCommand } from 'commander';
import path from 'path';

import * as log from '../log';
import { generateVisualization } from '../visualization';

export function visualize() {
  return createCommand('visualize')
    .description(
      'generate graph visualization of collected entities and relationships',
    )
    .option(
      '-d, --data-dir <directory>',
      'path to collected entities and relationships',
      path.resolve(process.cwd(), '.j1-integration', 'graph'),
    )
    .option(
      '-o, --output-file <path>',
      'path of generated HTML file',
      path.resolve(process.cwd(), '.j1-integration', 'index.html'),
    )
    .action(async (options) => {
      const dataDir = path.resolve(options.dataDir);
      const outputFile = path.resolve(options.outputFile);
      await generateVisualization(dataDir, outputFile);
      log.info(`Visualize graph here: ${outputFile}`);
    });
}
