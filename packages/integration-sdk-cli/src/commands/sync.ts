import { createCommand } from 'commander';

import {
  createApiClientWithApiKey,
  createIntegrationInstanceForLocalExecution,
  createIntegrationLogger,
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  synchronizeCollectedData,
} from '@jupiterone/integration-sdk-runtime';

import { loadConfig } from '../config';
import * as log from '../log';

export function sync() {
  return createCommand('sync')
    .description('Synchronizes collected data with the JupiterOne graph.')
    .requiredOption(
      '-i, --integrationInstanceId <id>',
      'The id of the integration instance to associate uploaded entities and relationships with.',
    )
    .action(async (options) => {
      log.debug('Loading API Key from JUPITERONE_API_KEY environment variable');
      const apiKey = getApiKeyFromEnvironment();
      const apiBaseUrl = getApiBaseUrl({ dev: !!process.env.JUPITERONE_DEV });

      log.debug(`Configuring client to access "${apiBaseUrl}"`);

      const apiClient = createApiClientWithApiKey({
        apiBaseUrl,
        apiKey,
      });

      const { integrationInstanceId } = options;

      const logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });

      const invocationConfig = await loadConfig();
      const instance = createIntegrationInstanceForLocalExecution(
        invocationConfig,
      );

      const job = await synchronizeCollectedData({
        logger: logger.child({ integrationInstanceId }),
        apiClient,
        integrationInstanceId,
        syncMode: await invocationConfig.getSyncMode?.({ logger, instance }),
      });

      log.displaySynchronizationResults(job);
    });
}
