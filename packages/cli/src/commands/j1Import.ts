import { createCommand } from 'commander';
import * as log from '../log';
import path from 'path';
import { importAssets } from '../import/importAssets';
import { validateOption } from '../validateOption';

export interface ImportOptions {
  dataDir: string;
  includeEntities?: boolean;
  includeRelationships?: boolean;
  scope: string;
  account: string;
  apiKey: string;
}

export function j1Import() {
  return createCommand('import')
    .description(
      'Imports exported account entities/relationships into JupiterOne account',
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
      '--account <account>',
      'The JupiterOne account you are importing entities/relationships into',
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

      await importAssets({ ...options, storageDirectory, account, apiKey });
    });
}
