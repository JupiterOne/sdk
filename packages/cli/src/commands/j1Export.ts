import { createCommand } from 'commander';
import path from 'path';

import * as log from '../log';
import exportAssets from '../export/exportAssets';
import { validateOption } from '../validateOption';

export interface ExportOptions {
  dataDir: string;
  account: string;
  apiKey: string;
  includeEntities: boolean;
  includeRelationships: boolean;
  includeDeleted: boolean;
}

export const DEFAULT_EXPORT_DIRECTORY = '.j1/export';

export function j1Export() {
  return createCommand('export')
    .description("Exports account's entities/relationships into csv files")
    .option(
      '-d, --data-dir <relative_directory>',
      'The directory where entities/relationships will be downloaded',
      DEFAULT_EXPORT_DIRECTORY,
    )
    .option(
      '--account <account>',
      'The JupiterOne account you are importing entities/relationships into',
    )
    .option(
      '--api-key <key>',
      'The key used to initiate api calls with your instance of JupiterOne',
    )
    .option('--include-entities', 'Include entities in export', true)
    .option('--include-relationships', 'Include relationships in export', true)
    .option(
      '--include-deleted',
      'Include deleted entities/relationships in export',
      true,
    )
    .option('--no-include-entities', 'Exclude entities in export')
    .option('--no-include-relationships', 'Exclude relationships in export')
    .option(
      '--no-include-deleted',
      'Exclude deleted entities/relationships in export',
    )
    .action(async (options: ExportOptions) => {
      log.info(`Starting export...`);
      const storageDirectory = path.join(process.cwd(), options.dataDir);
      const apiKey = validateOption({
        option: '--api-key',
        value: options.apiKey,
        defaultEnvironmentVariable: 'JUPITERONE_API_KEY',
      });
      const account = validateOption({
        option: '--account',
        value: options.account,
        defaultEnvironmentVariable: 'JUPITERONE_ACCOUNT',
      });

      await exportAssets({ ...options, storageDirectory, account, apiKey });
    });
}
