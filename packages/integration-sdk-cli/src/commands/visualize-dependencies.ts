import { createCommand } from 'commander';
import path from 'path';

import { generateDependencyVisualization } from '../visualization';

export function visualizeDependencies() {
  return createCommand('visualize-dependencies')
    .description('visualize dependency graph of integration')
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-o, --output-file <path>',
      'path of generated HTML file',
      path.resolve(process.cwd(), 'dependencies.html'),
    )
    .action(async (options) => {
      const integrationDir = path.resolve(options.projectPath);
      const outputFile = path.resolve(options.outputFile);
      await generateDependencyVisualization(integrationDir, outputFile);
    });
}
