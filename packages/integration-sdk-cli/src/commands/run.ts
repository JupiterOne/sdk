import { createCommand } from 'commander';

import { Metric } from '@jupiterone/integration-sdk-core';
import {
  abortSynchronization,
  createApiClientWithApiKey,
  createEventPublishingQueue,
  createIntegrationInstanceForLocalExecution,
  createIntegrationLogger,
  executeIntegrationInstance,
  finalizeSynchronization,
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  initiateSynchronization,
  uploadCollectedData,
} from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';
import * as log from '../log';

export function run() {
  return createCommand('run')
    .description(
      'Performs collection and synchronization of entities and relationships.',
    )
    .requiredOption(
      '-i, --integrationInstanceId <id>',
      'The integration instance ID to which uploaded entities and relationships belong (synchronization scope).',
    )
    .action(async (options) => {
      log.debug('Loading API Key from JUPITERONE_API_KEY environment variable');
      const apiKey = getApiKeyFromEnvironment();
      const apiBaseUrl = getApiBaseUrl({ dev: !!process.env.JUPITERONE_DEV });
      log.debug(`Configuring client to access "${apiBaseUrl}"`);

      const startTime = Date.now();

      const apiClient = createApiClientWithApiKey({
        apiBaseUrl,
        apiKey,
      });

      const { integrationInstanceId } = options;

      let logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });

      const invocationConfig = await loadConfig();
      const instance = createIntegrationInstanceForLocalExecution(
        invocationConfig,
      );

      const synchronizationContext = await initiateSynchronization({
        logger,
        apiClient,
        integrationInstanceId,
        syncMode: await invocationConfig.getSyncMode?.({ logger, instance }),
      });

      logger = synchronizationContext.logger;

      const eventPublishingQueue = createEventPublishingQueue(
        synchronizationContext,
      );

      const metrics: Metric[] = [];
      logger
        .on('event', (event) => eventPublishingQueue.enqueue(event))
        .on('metric', (metric) => metrics.push(metric));

      try {
        const executionResults = await executeIntegrationInstance(
          logger,
          instance,
          invocationConfig,
          {
            enableSchemaValidation: true,
          },
        );

        await eventPublishingQueue.onIdle();

        log.displayExecutionResults(executionResults);

        await uploadCollectedData(synchronizationContext);

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
