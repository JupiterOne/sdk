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
import {
  addLoggingOptions,
  addPathOptionsToCommand,
  configureRuntimeFilesystem,
} from './options';

import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

// coercion function to collect multiple values for a flag
const collector = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

export function collect() {
  const command = createCommand('collect');
  addPathOptionsToCommand(command);
  addLoggingOptions(command);

  return command
    .description('collect data and store entities and relationships to disk')
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
    .action(async (options) => {
      configureRuntimeFilesystem(options);

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
        prettifyFiles: !options.noPretty,
        integrationSteps: config.integrationSteps,
      });

      const enableSchemaValidation = !options.disableSchemaValidation;

      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'integration-sdk',
          [SemanticResourceAttributes.SERVICE_VERSION]: '0.1.0',
        }),
      );
      const tracerProvider = new NodeTracerProvider({
        resource,
      });
      const exporter = new OTLPTraceExporter({
        url:
          'http://' +
          (process.env.OTEL_COLLECTOR_URL ?? 'localhost:4318') +
          '/v1/traces',
      });
      const processor = new BatchSpanProcessor(exporter);
      tracerProvider.addSpanProcessor(processor);
      tracerProvider.register();
      registerInstrumentations({
        instrumentations: [
          getNoodeAutoInstrumentations();
        ]
      })

      const tracer = tracerProvider.getTracer('tracer');
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
          pretty: !options.noPretty,
          tracer,
        },
      );

      await tracerProvider.forceFlush();
      await tracerProvider.shutdown();
      await processor.forceFlush();
      await exporter.forceFlush();

      await exporter.shutdown();

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
