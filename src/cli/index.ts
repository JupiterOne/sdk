import { createCommand } from 'commander';

import { collect, visualize } from './commands';

export function createCli() {
  return createCommand().addCommand(collect()).addCommand(visualize());
}
