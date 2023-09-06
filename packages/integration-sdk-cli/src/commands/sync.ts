import { Command, createCommand, OptionValues } from 'commander';

import {
  createApiClient,
  createIntegrationLogger,
  synchronizeCollectedData,
} from '@jupiterone/integration-sdk-runtime';

import * as log from '../log';
import {
  addApiClientOptionsToCommand,
  addLoggingOptions,
  addPathOptionsToCommand,
  addSyncOptionsToCommand,
  configureRuntimeFilesystem,
  getApiClientOptions,
  getSyncOptions,
  validateApiClientOptions,
  validateSyncOptions,
} from './options';

export function sync(): Command {
  const command = createCommand('sync');

  addPathOptionsToCommand(command);
  addApiClientOptionsToCommand(command);
  addSyncOptionsToCommand(command);
  addLoggingOptions(command);

  return command
    .description(
      'sync collected data with JupiterOne, requires JUPITERONE_API_KEY, JUPITERONE_ACCOUNT',
    )
    .action(async (options: OptionValues, actionCommand: Command) => {
      configureRuntimeFilesystem(actionCommand.opts());
      validateApiClientOptions(actionCommand.opts());
      validateSyncOptions(actionCommand.opts());

      const clientApiOptions = getApiClientOptions(actionCommand.opts());
      const apiClient = createApiClient(clientApiOptions);
      log.debug(
        `Configured JupiterOne API client. (apiBaseUrl: '${clientApiOptions.apiBaseUrl}', account: ${clientApiOptions.account})`,
      );

      const logger = createIntegrationLogger({
        name: 'local',
        pretty: !options.noPretty,
      });

      const syncOptions = getSyncOptions(actionCommand.opts());
      if (syncOptions.skipFinalize)
        log.info(
          'Skipping synchronization finalization. Job will remain in "AWAITING_UPLOADS" state.',
        );

      const job = await synchronizeCollectedData({
        logger: logger.child(syncOptions),
        apiClient,
        ...syncOptions,
      });

      log.displaySynchronizationResults(job);
    });
}
