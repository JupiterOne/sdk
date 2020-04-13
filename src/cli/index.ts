import { createCommand } from 'commander';

import { collect } from './commands';

export function createCli() {
  return createCommand().addCommand(collect());
}
