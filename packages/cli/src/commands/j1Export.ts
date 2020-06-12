import { createCommand } from 'commander';
import * as log from '../log';
import exportAssets from '../export/exportAssets';

export interface ExportOptions {
  dataDir: string;
  excludeEntities?: boolean;
  excludeRelationships?: boolean;
}

export function j1Export() {
  return createCommand()
    .command('export <account>')
    .description(
      'Downloads j1 account entities/relationships into csv files'
    )
    .option(
      '-d, --data-dir <relative_directory>',
      'The directory where entities/relationships will be downloaded',
      '.j1/export'
    )
    .option(
      '--exclude-entities',
      'Exclude entities from export'
    )
    .option(
      '--exclude-relationships',
      'Exclude relationships from export'
    )
    .action(async (account: string, options: ExportOptions) => {
      log.info(`Starting export...`);
      await exportAssets({ account, ...options });
    })
};
