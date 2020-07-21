import { createCommand } from 'commander';
import path from 'path';

import * as log from '../log';
import exportAssets from '../export/exportAssets';
import { validateApiKey } from '../validateApiKey';

export interface ExportOptions {
  dataDir: string;
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
      const apiKey = validateApiKey(options.apiKey);

      await exportAssets({ ...options, storageDirectory, apiKey });
    });
}
