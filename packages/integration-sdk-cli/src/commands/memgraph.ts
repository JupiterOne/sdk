import * as commander from 'commander';
import path from 'path';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import * as log from '../log';
import { uploadToMemgraph, wipeMemgraphByID, wipeAllMemgraph } from '../memgraph';

export function memgraph() {
  dotenvExpand(dotenv.config());

  const program = new commander.Command();
  program.description(
    `Suite of memgraph commands.  Options are currently 'memgraph push', 'memgraph wipe', and 'memgraph wipe-all'`,
  );
  const memgraphCommand = program.command('memgraph');
  memgraphCommand
    .command('push')
    .description('upload collected entities and relationships to local Memgraph')
    .option(
      '-d, --data-dir <directory>',
      'path to collected entities and relationships',
      path.resolve(process.cwd(), '.j1-integration'),
    )
    .option(
      '-i, --integration-instance-id <id>',
      '_integrationInstanceId assigned to uploaded entities',
      'defaultLocalInstanceID',
    )
    .option(
      '-db, --database-name <database>',
      'optional database to push data to (only available for enterprise Memgraph databases)',
      'memgraph',
    )
    .action(async (options) => {
      log.info(`Beginning data upload to local Memgraph instance`);
      // Point `fileSystem.ts` functions to expected location relative to
      // integration project path.
      const finalDir = path.resolve(process.cwd(), options.dataDir);
      process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = finalDir;

      await uploadToMemgraph({
        pathToData: finalDir,
        integrationInstanceID: options.integrationInstanceId,
        memgraphDatabase: options.databaseName,
      });
      log.info(`Data uploaded to local Memgraph instance`);
    });

  memgraphCommand
    .command('wipe')
    .description(
      'wipe entities and relationships for a given integrationInstanceID in the Memgraph database',
    )
    .option(
      '-i, --integration-instance-id <id>',
      '_integrationInstanceId assigned to uploaded entities',
      'defaultLocalInstanceID',
    )
    .option(
      '-db, --database-name <database>',
      'optional database to wipe data from (only available for enterprise Memgraph databases)',
      'memgraph',
    )
    .action(async (options) => {
      await wipeMemgraphByID({
        integrationInstanceID: options.integrationInstanceId,
        memgraphDatabase: options.databaseName,
      });
    });

  memgraphCommand
    .command('wipe-all')
    .description('wipe all entities and relationships in the Memgraph database')
    .option(
      '-db, --database-name <database>',
      'optional database to wipe data from (only available for enterprise Memgraph databases)',
      'memgraph',
    )
    .action(async (options) => {
      await wipeAllMemgraph({
        memgraphDatabase: options.databaseName,
      });
    });

  return memgraphCommand;
}
