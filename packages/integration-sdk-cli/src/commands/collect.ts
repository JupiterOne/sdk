import { createCommand } from 'commander';
import path from 'path';
import fs from 'fs-extra';

import {
  executeIntegrationLocally,
  FileSystemGraphObjectStore,
  getRootCacheDirectory,
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

      if (
        typeof options.useDependenciesCache === 'string' ||
        options.useDependenciesCache instanceof String
      ) {
        setupCacheDirectory(options.useDependenciesCache);
      } else if (options.useDependenciesCache === true) {
        await copyToCache();
      }

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
          useDependenciesCache: options.useDependenciesCache,
          graphObjectStore,
        },
      );

      log.displayExecutionResults(results);
    });
}

/**
 * Sets environment variable JUPITERONE_CACHE_DIRECTORY
 * to be used in reading & writing to cache.
 * @param useDependenciesCache
 */
function setupCacheDirectory(useDependenciesCache) {
  process.env.JUPITERONE_CACHE_DIRECTORY = path.resolve(
    useDependenciesCache,
    '.j1-cache',
  );

  log.info(
    `Set dependencies cache location to ${process.env.JUPITERONE_CACHE_DIRECTORY}`,
  );
}

/**
 * When no filepath is specified, the .j1-integration directory
 * is copied to .j1-cache
 */
async function copyToCache() {
  const graphDirectory = path.join(getRootStorageDirectory(), 'graph');
  if (fs.ensureDir(graphDirectory)) {
    await fs.emptyDir(getRootCacheDirectory());
    await fs.copy(graphDirectory, getRootCacheDirectory()).catch((error) => {
      log.error(`Failed to seed .j1-cache from .j1-integration`);
      log.error(error);
    });
    log.info(`Copied graph data in .j1-integration to .j1-cache`);
  }
}
