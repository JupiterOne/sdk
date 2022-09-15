import { createCommand } from 'commander';
import path from 'path';

import {
  createApiClient,
  createIntegrationLogger,
  getAccountFromEnvironment,
  getApiKeyFromEnvironment,
  synchronizeCollectedData,
} from '@jupiterone/integration-sdk-runtime';

import * as log from '../log';
import {
  getApiBaseUrlOption,
  getSynchronizationJobSourceOptions,
} from './options';

export function sync() {
  return createCommand('sync')
    .description(
      'sync collected data with JupiterOne, requires JUPITERONE_API_KEY, JUPITERONE_ACCOUNT',
    )
    .option(
      '-i, --integrationInstanceId <id>',
      '_integrationInstanceId assigned to uploaded entities and relationships',
    )
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-d, --development',
      '"true" to target apps.dev.jupiterone.io',
      !!process.env.JUPITERONE_DEV,
    )
    .option('--api-base-url <url>', 'API base URL used during sync operation.')
    .option(
      '--source <integration-managed|integration-external|api>',
      'configure the synchronization job source value',
      'integration-managed',
    )
    .option(
      '--scope <anystring>',
      'configure the synchronization job scope value',
    )
    .option(
      '-u, --upload-batch-size <number>',
      'specify number of items per batch for upload (default 250)',
    )
    .option(
      '-ur, --upload-relationship-batch-size <number>',
      'specify number of relationships per batch for upload (default 250)',
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

      const apiBaseUrl = getApiBaseUrlOption(options);
      log.debug(`Configuring client to access "${apiBaseUrl}"`);

      const apiClient = createApiClient({
        apiBaseUrl,
        account,
        accessToken,
      });

      const synchronizationJobSourceOptions =
        getSynchronizationJobSourceOptions(options);

      const logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });
      const job = await synchronizeCollectedData({
        logger: logger.child(synchronizationJobSourceOptions),
        apiClient,
        uploadBatchSize: options.uploadBatchSize,
        uploadRelationshipBatchSize: options.uploadRelationshipBatchSize,
        ...synchronizationJobSourceOptions,
      });

      log.displaySynchronizationResults(job);
    });
}
