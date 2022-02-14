import { createCommand } from 'commander';
import path from 'path';
import fs from 'fs-extra';

import {
  executeIntegrationLocally,
  FileSystemGraphObjectStore,
  getRootStorageDirectory,
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
      '-C, --use-dependencies-cache [filePath]',
      'Loads cache for the dependencies required by the step(s) specified in --step option. Execution of these steps is skipped. Data found in .j1-integration is used if no filepath is provided.',
    )
    .option('-V, --disable-schema-validation', 'disable schema validation')
    .action(async (options) => {
      if (options.useDependenciesCache && options.step.length === 0) {
        throw new Error(
          'Invalid option: Option --use-dependencies-cache requires option --step to also be specified.',
        );
      }

      // Point `fileSystem.ts` functions to expected location relative to
      // integration project path.
      process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = path.resolve(
        options.projectPath,
        '.j1-integration',
      );

      if (options.useDependenciesCache === true) {
        // true indicates that a filepath was not specified
        // therefore, copy .j1-integration into .j1-cache
        await copyToCache();
      }

      const config = prepareLocalStepCollection(
        await loadConfig(path.join(options.projectPath, 'src')),
        {
          ...options,
          ...(options.useDependenciesCache && {
            dependenciesCache: {
              enabled: true,
              filepath: getRootCacheDirectory(options.useDependenciesCache),
            },
          }),
        },
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

export const DEFAULT_CACHE_DIRECTORY_NAME = '.j1-cache';

export function getRootCacheDirectory(filepath?: string) {
  return path.resolve(
    typeof filepath === 'string' ? filepath : process.cwd(),
    DEFAULT_CACHE_DIRECTORY_NAME,
  );
}

/**
 * When no filepath is specified, the .j1-integration/graph directory
 * is moved to .j1-cache
 */
async function copyToCache() {
  const sourceGraphDirectory = path.join(getRootStorageDirectory(), 'graph');
  const destinationGraphDirectory = path.join(getRootCacheDirectory(), 'graph');

  if (fs.pathExistsSync(sourceGraphDirectory)) {
    await fs
      .move(sourceGraphDirectory, destinationGraphDirectory, {
        overwrite: true,
      })
      .catch((error) => {
        log.error(`Failed to seed .j1-cache from .j1-integration`);
        log.error(error);
      });
    log.info(`Populated the .j1-cache from .j1-integration.`);
  }
}
