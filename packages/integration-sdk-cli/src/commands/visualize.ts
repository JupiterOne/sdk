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
      'absolute path to collected entities and relationships',
      path.resolve(process.cwd(), '.j1-integration', 'graph'),
    )
    .option(
      '-o, --output-file <path>',
      'absolute path of generated HTML file',
      path.resolve(process.cwd(), '.j1-integration', 'index.html'),
    )
    .action(async (options) => {
      await generateVisualization(options.dataDir, options.outputFile);
      log.info(`Visualize graph here: ${options.outputFile}`);
    });
}
