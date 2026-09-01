import { createCommand } from 'commander';

import {
  collect,
  diff,
  document,
  run,
  sync,
  visualize,
  visualizeTypes,
  validateQuestionFile,
  memgraph,
  neo4j,
  visualizeDependencies,
  generateIntegrationGraphSchemaCommand,
  generateIngestionSourcesConfigCommand,
  generate,
  bocchi,
} from './commands';

export function createCli() {
  return createCommand()
    .addCommand(collect())
    .addCommand(diff())
    .addCommand(visualize())
    .addCommand(sync())
    .addCommand(run())
    .addCommand(visualizeTypes())
    .addCommand(document())
    .addCommand(validateQuestionFile())
    .addCommand(memgraph())
    .addCommand(neo4j())
    .addCommand(visualizeDependencies())
    .addCommand(generateIntegrationGraphSchemaCommand())
    .addCommand(generateIngestionSourcesConfigCommand())
    .addCommand(generate())
    .addCommand(bocchi());
}
