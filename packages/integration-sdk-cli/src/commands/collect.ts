import { createCommand } from 'commander';
import path from 'path';

import {
  executeIntegrationLocally,
  FileSystemGraphObjectStore,
  prepareLocalStepCollection,
} from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';
import * as log from '../log';

// coercion function to collect multiple values for a flag
const collector = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

export function collect() {
  return createCommand('collect')
    .description('collect data and store entities and relationships to disk')
    .option(
      '-p, --project-path <directory>',
      'absolute path to integration project directory',
      process.cwd(),
    )
    .option(
      '-s, --step <steps>',
      'step(s) to run, comma separated',
      collector,
      [],
    )
    .option('-V, --disable-schema-validation', 'disable schema validation')
    .action(async (options) => {
      // Point `fileSystem.ts` functions to expected location relative to
      // integration project path.
      process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = path.resolve(
        options.projectPath,
        '.j1-integration',
      );

      const config = prepareLocalStepCollection(
        await loadConfig(path.join(options.projectPath, 'src')),
        options,
      );
      log.info('\nConfiguration loaded! Running integration...\n');

      const graphObjectStore = new FileSystemGraphObjectStore({
        prettifyFiles: true,
        integrationSteps: config.integrationSteps,
      });

      const enableSchemaValidation = !options.disableSchemaValidation;
      const results = await executeIntegrationLocally(
        config,
        {
          current: {
            startedOn: Date.now(),
          },
        },
        {
          enableSchemaValidation,
          graphObjectStore,
        },
      );

      log.displayExecutionResults(results);
    });
}
