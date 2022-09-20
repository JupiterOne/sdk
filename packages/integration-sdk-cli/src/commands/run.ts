import { Command, createCommand, OptionValues } from 'commander';
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
  initiateSynchronization,
  synchronizationStatus,
} from '@jupiterone/integration-sdk-runtime';
import { createPersisterApiStepGraphObjectDataUploader } from '@jupiterone/integration-sdk-runtime/dist/src/execution/uploader';

import { loadConfig } from '../config';
import * as log from '../log';
import {
  addApiClientOptionsToCommand,
  addPathOptionsToCommand,
  addSyncOptionsToCommand,
  configureRuntimeFilesystem,
  getApiClientOptions,
  getSyncOptions,
  validateApiClientOptions,
  validateSyncOptions,
} from './options';

const DEFAULT_UPLOAD_CONCURRENCY = 5;

export function run(): Command {
  const command = createCommand('run');

  addPathOptionsToCommand(command);
  addApiClientOptionsToCommand(command);
  addSyncOptionsToCommand(command);

  return command
    .description('collect and sync to upload entities and relationships')
    .option('-V, --disable-schema-validation', 'disable schema validation')
    .action(async (options: OptionValues, actionCommand: Command) => {
      configureRuntimeFilesystem(actionCommand.opts());
      validateApiClientOptions(actionCommand.opts());
      validateSyncOptions(actionCommand.opts());

      const startTime = Date.now();

      const clientApiOptions = getApiClientOptions(actionCommand.opts());
      const apiClient = createApiClient(clientApiOptions);
      log.debug(
        `Configured JupiterOne API client. (apiBaseUrl: '${clientApiOptions.apiBaseUrl}', account: ${clientApiOptions.account})`,
      );

      let logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });

      const synchronizationContext = await initiateSynchronization({
        logger,
        apiClient,
        ...getSyncOptions(actionCommand.opts()),
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
        path.resolve(options.projectPath, 'src'),
      );

      const graphObjectStore = new FileSystemGraphObjectStore({
        prettifyFiles: true,
        integrationSteps: invocationConfig.integrationSteps,
      });

      try {
        const enableSchemaValidation = !options.disableSchemaValidation;
        const executionResults = await executeIntegrationInstance(
          logger,
          createIntegrationInstanceForLocalExecution(invocationConfig),
          invocationConfig,
          {
            current: {
              startedOn: synchronizationContext.job.startTimestamp,
            },
          },
          {
            enableSchemaValidation,
            graphObjectStore,
            createStepGraphObjectDataUploader(stepId) {
              return createPersisterApiStepGraphObjectDataUploader({
                stepId,
                synchronizationJobContext: synchronizationContext,
                uploadConcurrency: DEFAULT_UPLOAD_CONCURRENCY,
                uploadBatchSize: options.uploadBatchSize,
                uploadRelationshipsBatchSize:
                  options.uploadRelationshipBatchSize,
              });
            },
          },
        );

        await eventPublishingQueue.onIdle();

        log.displayExecutionResults(executionResults);

        if (options.skipFinalize) {
          log.info(
            'Skipping synchronization finalization. Job will remain in "AWAITING_UPLOADS" state.',
          );
          const jobStatus = await synchronizationStatus(synchronizationContext);
          log.displaySynchronizationResults(jobStatus);
        } else {
          const synchronizationResult = await finalizeSynchronization({
            ...synchronizationContext,
            partialDatasets: executionResults.metadata.partialDatasets,
          });
          log.displaySynchronizationResults(synchronizationResult);
        }
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
