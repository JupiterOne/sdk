import { createCommand } from 'commander';
import path from 'path';

import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

import * as log from '../log';
import { uploadToNeo4j } from '../neo4j';

export function neo4j() {
  dotenvExpand(dotenv.config());

  return createCommand('neo4j')
    .description('upload collected entities and relationships to local Neo4j')
    .option(
      '-d, --data-dir <directory>',
      'path to collected entities and relationships',
      path.resolve(process.cwd(), '.j1-integration', 'graph'),
    )
    .option(
      '-o, --output-file <path>',
      'path of generated HTML file',
      path.resolve(process.cwd(), '.j1-integration', 'index.html'),
    )
    .action(async (options) => {
      // const dataDir = path.resolve(options.dataDir);
      // const outputFile = path.resolve(options.outputFile);
      log.info(`Beginning data upload to local neo4j`);
      await uploadToNeo4j();
      log.info(`Data uploaded to local neo4j`);
    });
}
