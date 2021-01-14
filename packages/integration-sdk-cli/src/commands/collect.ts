import { createCommand } from 'commander';

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
    .description(
      'Executes the integration and stores the collected data to disk',
    )
    .option(
      '-s, --step <steps>',
      'step(s) to run, comma separated if multiple',
      collector,
      [],
    )
    .option('-V, --disable-schema-validation', 'Disable schema validation')
    .action(async (options) => {
      const enableSchemaValidation = !options.disableSchemaValidation;
      const config = prepareLocalStepCollection(await loadConfig(), options);
      log.info('\nConfiguration loaded! Running integration...\n');

      const graphObjectStore = new FileSystemGraphObjectStore({
        prettifyFiles: true,
        integrationSteps: config.integrationSteps,
      });

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
