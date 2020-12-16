import { createCommand } from 'commander';

import { Metric } from '@jupiterone/integration-sdk-core';
import {
  abortSynchronization,
  createApiClient,
  createEventPublishingQueue,
  createIntegrationInstanceForLocalExecution,
  createIntegrationLogger,
  executeIntegrationInstance,
  finalizeSynchronization,
  getAccountFromEnvironment,
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  initiateSynchronization,
  // uploadCollectedData
} from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';
import * as log from '../log';
import { createPersisterApiStepGraphObjectDataUploader } from '@jupiterone/integration-sdk-runtime/dist/src/execution/uploader';

const DEFAULT_UPLOAD_CONCURRENCY = 5;

export function run() {
  return createCommand('run')
    .description('Performs the collection and synchronization of ')
    .requiredOption(
      '-i, --integrationInstanceId <id>',
      'The id of the integration instance to associate uploaded entities and relationships with.',
    )
    .action(async (options) => {
      log.debug('Loading API Key from JUPITERONE_API_KEY environment variable');
      const accessToken = getApiKeyFromEnvironment();

      log.debug('Loading account from JUPITERONE_ACCOUNT environment variable');
      const account = getAccountFromEnvironment();

      const apiBaseUrl = getApiBaseUrl({ dev: !!process.env.JUPITERONE_DEV });
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

      const invocationConfig = await loadConfig();

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
