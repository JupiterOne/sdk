import { createCommand } from 'commander';

import { j1Export, j1Import } from './commands';

export function createCli() {
  return createCommand().addCommand(j1Import()).addCommand(j1Export());
}
