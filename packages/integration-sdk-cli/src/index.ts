import { createCommand } from 'commander';

import { collect, visualize, sync, run, document } from './commands';

export function createCli() {
  return createCommand()
    .addCommand(collect())
    .addCommand(visualize())
    .addCommand(sync())
    .addCommand(run())
    .addCommand(document());
}
