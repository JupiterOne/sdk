import { createCommand } from 'commander';
import path from 'path';

import { Metric } from '@jupiterone/integration-sdk-core';
import {
  abortSynchronization,
  createApiClient,
  createEventPublishingQueue,
  createIntegrationInstanceForLocalExecution,
  createIntegrationLogger,
  executeIntegrationInstance,
  FileSystemGraphObjectStore,
  finalizeSynchronization,
  getAccountFromEnvironment,
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  initiateSynchronization,
} from '@jupiterone/integration-sdk-runtime';
import { createPersisterApiStepGraphObjectDataUploader } from '@jupiterone/integration-sdk-runtime/dist/src/execution/uploader';

import { loadConfig } from '../config';
import * as log from '../log';

const DEFAULT_UPLOAD_CONCURRENCY = 5;

export function run() {
  return createCommand('run')
    .description('collect and sync to upload entities and relationships')
    .requiredOption(
      '-i, --integrationInstanceId <id>',
      '_integrationInstanceId assigned to uploaded entities and relationships',
    )
    .option(
      '-p, --project-path <directory>',
      'absolute path to integration project directory',
      process.cwd(),
    )
    .option(
      '-d, --development',
      '"true" to target apps.dev.jupiterone.io',
      !!process.env.JUPITERONE_DEV,
    )
    .action(async (options) => {
      // Point `fileSystem.ts` functions to expected location relative to
      // integration project path.
      process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = path.resolve(
        options.projectPath,
        '.j1-integration',
      );

      log.debug('Loading API Key from JUPITERONE_API_KEY environment variable');
      const accessToken = getApiKeyFromEnvironment();

      log.debug('Loading account from JUPITERONE_ACCOUNT environment variable');
      const account = getAccountFromEnvironment();

      const apiBaseUrl = getApiBaseUrl({ dev: options.development });
      log.debug(`Configuring client to access "${apiBaseUrl}"`);

      const startTime = Date.now();

      const apiClient = createApiClient({
        apiBaseUrl,
        accessToken,
        account,
      });

      const { integrationInstanceId } = options;

      let logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });

      const synchronizationContext = await initiateSynchronization({
        logger,
        apiClient,
        integrationInstanceId,
      });

      logger = synchronizationContext.logger;

      const eventPublishingQueue = createEventPublishingQueue(
        synchronizationContext,
      );
      const metrics: Metric[] = [];

      logger
        .on('event', (event) => eventPublishingQueue.enqueue(event))
        .on('metric', (metric) => metrics.push(metric));

      const invocationConfig = await loadConfig(
        path.join(options.projectPath, 'src'),
      );

      const graphObjectStore = new FileSystemGraphObjectStore({
        prettifyFiles: true,
        integrationSteps: invocationConfig.integrationSteps,
      });

      try {
        const executionResults = await executeIntegrationInstance(
          logger,
          createIntegrationInstanceForLocalExecution(invocationConfig),
          invocationConfig,
          {
            current: {
              startedOn: startTime,
            },
          },
          {
            enableSchemaValidation: true,
            graphObjectStore,
            createStepGraphObjectDataUploader(stepId) {
              return createPersisterApiStepGraphObjectDataUploader({
                stepId,
                synchronizationJobContext: synchronizationContext,
                uploadConcurrency: DEFAULT_UPLOAD_CONCURRENCY,
              });
            },
          },
        );

        await eventPublishingQueue.onIdle();

        log.displayExecutionResults(executionResults);

        const synchronizationResult = await finalizeSynchronization({
          ...synchronizationContext,
          partialDatasets: executionResults.metadata.partialDatasets,
        });

        log.displaySynchronizationResults(synchronizationResult);
      } catch (err) {
        await eventPublishingQueue.onIdle();
        if (!logger.isHandledError(err)) {
          logger.error(
            err,
            'Unexpected error occurred during integration run.',
          );
        }

        const abortResult = await abortSynchronization({
          ...synchronizationContext,
          reason: err.message,
        });

        log.displaySynchronizationResults(abortResult);
      } finally {
        logger.publishMetric({
          name: 'duration-total',
          value: Date.now() - startTime,
          unit: 'Milliseconds',
        });
      }
    });
}
