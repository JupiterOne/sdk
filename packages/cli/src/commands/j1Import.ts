import { createCommand } from 'commander';
import * as log from '../log';
import path from 'path';
import { importAssets } from '../import/importAssets';
import { validateApiKey } from '../validateApiKey';

export interface ImportOptions {
  dataDir: string;
  includeEntities?: boolean;
  includeRelationships?: boolean;
  scope: string;
  apiKey?: string;
}

export function j1Import() {
  return createCommand('import')
    .description(
      'Imports exported account entities/relationships into j1 account',
    )
    .option(
      '-d --data-dir <relative_directory>',
      'The directory where entities and relationships can be found',
      '.j1/export',
    )
    .requiredOption(
      '--scope <scope>',
      'A unique id that identifies the synchronization job that will be importing your assets, use any id of your choosing.',
    )
    .option(
      '--api-key <key>',
      'The key used to initiate api calls with your instance of JupiterOne',
    )
    .option('--include-relationships', 'Include relationships in import', true)
    .option(
      '--include-deleted',
      'Include deleted entities/relationships in import',
      true,
    )
    .option('--no-include-entities', 'Exclude entities in import')
    .option('--no-include-relationships', 'Exclude relationships in import')
    .action(async (options: ImportOptions) => {
      log.info(`Importing entities into account...`);
      const storageDirectory = path.join(process.cwd(), options.dataDir);
      const apiKey = validateApiKey(options.apiKey);

      await importAssets({ ...options, storageDirectory, apiKey });
    });
}
