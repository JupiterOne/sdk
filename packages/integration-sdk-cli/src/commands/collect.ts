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
      'step(s) to run, comma separated. Utilizes available caches to speed up dependent steps.',
      collector,
      [],
    )
    .option(
      '--no-cache',
      'Can be used with the `--step` flag to disable the use of the cache.',
    )
    .option(
      '--cache-path <filepath>',
      'Can be used with the `--step` to specify a path to a non-default cache location.',
    )
    .option('-V, --disable-schema-validation', 'disable schema validation')
    .option(
      '-b, --buffer-size <number>',
      'specify buffer size for use in data collection (default 500)',
    )
    .action(async (options) => {
      if (!options.cache && options.step.length === 0) {
        throw new Error(
          'Invalid option: Option --no-cache requires option --step to also be specified.',
        );
      }
      if (options.cachePath && options.step.length === 0) {
        throw new Error(
          'Invalid option: Option --cache-path requires option --step to also be specified.',
        );
      }

      // Point `fileSystem.ts` functions to expected location relative to
      // integration project path.
      process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = path.resolve(
        options.projectPath,
        '.j1-integration',
      );

      if (options.step.length > 0 && options.cache && !options.cachePath) {
        // Step option was used, cache is wanted, and no cache path was provided
        // therefore, copy .j1-integration into .j1-integration-cache
        await buildCacheFromJ1Integration();
      }

      const config = prepareLocalStepCollection(
        await loadConfig(path.join(options.projectPath, 'src')),
        {
          ...options,
          dependenciesCache: {
            enabled: options.cache,
            filepath: getRootCacheDirectory(options.cachePath),
          },
        },
      );
      log.info('\nConfiguration loaded! Running integration...\n');

      const graphObjectStore = new FileSystemGraphObjectStore({
        prettifyFiles: true,
        integrationSteps: config.integrationSteps,
        graphObjectBufferThreshold: options.bufferSize,
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

export const DEFAULT_CACHE_DIRECTORY_NAME = '.j1-integration-cache';

export function getRootCacheDirectory(filepath?: string) {
  return path.resolve(
    typeof filepath === 'string' ? filepath : process.cwd(),
    DEFAULT_CACHE_DIRECTORY_NAME,
  );
}

/**
 * Builds the step cache from the .j1-integration/graph directory
 * by moving the files to .j1-integration-cache.
 */
async function buildCacheFromJ1Integration() {
  const sourceGraphDirectory = path.join(getRootStorageDirectory(), 'graph');
  const destinationGraphDirectory = path.join(getRootCacheDirectory(), 'graph');

  const sourceExists = await fs.pathExists(sourceGraphDirectory);
  if (sourceExists) {
    await fs
      .move(sourceGraphDirectory, destinationGraphDirectory, {
        overwrite: true,
      })
      .catch((error) => {
        log.error(`Failed to seed .j1-integration-cache from .j1-integration`);
        log.error(error);
      });
    log.info(`Populated the .j1-integration-cache from .j1-integration.`);
  }
}
