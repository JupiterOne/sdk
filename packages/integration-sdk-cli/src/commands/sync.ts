import { createCommand } from 'commander';
import path from 'path';

import {
  createApiClient,
  createIntegrationLogger,
  getAccountFromEnvironment,
  getApiBaseUrl,
  getApiKeyFromEnvironment,
  synchronizeCollectedData,
} from '@jupiterone/integration-sdk-runtime';

import * as log from '../log';

export function sync() {
  return createCommand('sync')
    .description(
      'sync collected data with JupiterOne, requires JUPITERONE_API_KEY, JUPITERONE_ACCOUNT',
    )
    .requiredOption(
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

      let apiBaseUrl: string;
      if (options.apiBaseUrl) {
        if (options.development) {
          throw new Error(
            'Invalid configuration supplied.  Cannot specify both --api-base-url and --development(-d) flags.',
          );
        }
        apiBaseUrl = options.apiBaseUrl;
      } else {
        apiBaseUrl = getApiBaseUrl({
          dev: options.development,
        });
      }
      log.debug(`Configuring client to access "${apiBaseUrl}"`);

      const apiClient = createApiClient({
        apiBaseUrl,
        account,
        accessToken,
      });

      const { integrationInstanceId } = options;

      const logger = createIntegrationLogger({
        name: 'local',
        pretty: true,
      });

      const job = await synchronizeCollectedData({
        logger: logger.child({ integrationInstanceId }),
        apiClient,
        integrationInstanceId,
      });

      log.displaySynchronizationResults(job);
    });
}
