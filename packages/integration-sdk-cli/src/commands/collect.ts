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
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-s, --step <steps>',
      'step(s) to run, comma separated',
      collector,
      [],
    )
    .option(
      '-I, --ignore-step-dependencies',
      'Ignores the dependencies required by the step(s) specified in --step option. Previously captured data found in .j1-integration is loaded for ignored steps.',
    )
    .option('-V, --disable-schema-validation', 'disable schema validation')
    .action(async (options) => {
      if (options.ignoreStepDependencies && options.step.length === 0) {
        throw new Error(
          'Invalid option: Option --ignore-step-dependencies requires option --step to also be specified.',
        );
      }

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
      const useStorageForIgnoredStepDependencies =
        options.ignoreStepDependencies;
      const results = await executeIntegrationLocally(
        config,
        {
          current: {
            startedOn: Date.now(),
          },
        },
        {
          enableSchemaValidation,
          useStorageForIgnoredStepDependencies,
          graphObjectStore,
        },
      );

      log.displayExecutionResults(results);
    });
}
