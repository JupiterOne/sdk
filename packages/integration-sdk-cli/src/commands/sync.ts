import { createCommand } from 'commander';

import * as log from '../log';
import {
  getApiKeyFromEnvironment,
  getAccountFromEnvironment,
  getApiBaseUrl,
  createApiClient,
  createIntegrationLogger,
  synchronizeCollectedData,
} from '@jupiterone/integration-sdk-runtime';

export function sync() {
  return createCommand('sync')
    .description(
      'Synchronizes collected data with the JupiterOne graph. \n\n' +
        'Requires Environment Variables: \n' +
        '\t JUPITERONE_API_KEY - Created in the INTEGRATION API KEYS section of the integration instance configuration page \n' +
        '\t JUPITERONE_ACCOUNT - Your JupiterOne accountId',
    )
    .requiredOption(
      '-i, --integrationInstanceId <id>',
      'The id of the integration instance to associate uploaded entities and relationships with.',
    )
    .option(
      '-d, --development',
      '"true" to target the development environment instead of production.',
    )
    .action(async (options) => {
      log.debug('Loading API Key from JUPITERONE_API_KEY environment variable');
      const accessToken = getApiKeyFromEnvironment();

      log.debug('Loading account from JUPITERONE_ACCOUNT environment variable');
      const account = getAccountFromEnvironment();

      const apiBaseUrl = getApiBaseUrl({
        dev: process.env.JUPITERONE_DEV || options.development,
      });
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
