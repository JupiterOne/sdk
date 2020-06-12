import { createCommand } from 'commander';
import * as log from '../log';

export function j1Import() {
  return createCommand('import')
    .description(
      'Import j1 entities/relationships into j1 account'
    )
    .option(
      '-d --data-dir <relative_directory>',
      'The directory where entities and relationships can be found',
      '.j1/export'
    )
    .option(
      '-i --import <type>',
      'Choose what to import into the account: [all, entities, relationships]',
      'all'
    )
    .action(async (options) => {
      log.info(`Importing entities into account...`);
    })
};
