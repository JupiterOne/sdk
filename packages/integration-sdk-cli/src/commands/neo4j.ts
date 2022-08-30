import * as commander from 'commander';
import path from 'path';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import * as log from '../log';
import { uploadToNeo4j, wipeNeo4jByID, wipeAllNeo4j } from '../neo4j';

export function neo4j() {
  dotenvExpand(dotenv.config());

  const program = new commander.Command();
  program.description(
    `Suite of neo4j commands.  Options are currently 'neo4j push', 'neo4j wipe', and 'neo4j wipe-all'`,
  );
  const neo4jCommand = program.command('neo4j');
  neo4jCommand
    .command('push')
    .description('upload collected entities and relationships to local Neo4j')
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
      'optional database to push data to (only available for enterprise Neo4j databases)',
      'neo4j',
    )
    .action(async (options) => {
      log.info(`Beginning data upload to local neo4j`);
      // Point `fileSystem.ts` functions to expected location relative to
      // integration project path.
      const finalDir = path.resolve(process.cwd(), options.dataDir);
      process.env.JUPITERONE_INTEGRATION_STORAGE_DIRECTORY = finalDir;

      await uploadToNeo4j({
        pathToData: finalDir,
        integrationInstanceID: options.integrationInstanceId,
      });
      log.info(`Data uploaded to local neo4j`);
    });

  neo4jCommand
    .command('wipe')
    .description(
      'wipe entities and relationships for a given integrationInstanceID in the Neo4j database',
    )
    .option(
      '-i, --integration-instance-id <id>',
      '_integrationInstanceId assigned to uploaded entities',
      'defaultLocalInstanceID',
    )
    .option(
      '-db, --database-name <database>',
      'optional database to wipe data from (only available for enterprise Neo4j databases)',
      'neo4j',
    )
    .action(async (options) => {
      await wipeNeo4jByID({
        integrationInstanceID: options.integrationInstanceId,
      });
    });

  neo4jCommand
    .command('wipe-all')
    .description('wipe all entities and relationships in the Neo4j database')
    .option(
      '-db, --database-name <database>',
      'optional database to wipe data from (only available for enterprise Neo4j databases)',
      'neo4j',
    )
    .action(async (options) => {
      await wipeAllNeo4j({});
    });

  return neo4jCommand;
}
