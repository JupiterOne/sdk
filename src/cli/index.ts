import { createCommand } from 'commander';

import { collect, visualize, sync } from './commands';

export function createCli() {
  return createCommand()
    .addCommand(collect())
    .addCommand(visualize())
    .addCommand(sync());
}
