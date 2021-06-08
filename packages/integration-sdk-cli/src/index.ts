import { createCommand } from 'commander';

import {
  collect,
  compare,
  visualize,
  sync,
  run,
  document,
  visualizeTypes,
} from './commands';

export function createCli() {
  return createCommand()
    .addCommand(collect())
    .addCommand(compare())
    .addCommand(visualize())
    .addCommand(sync())
    .addCommand(run())
    .addCommand(visualizeTypes())
    .addCommand(document());
}
