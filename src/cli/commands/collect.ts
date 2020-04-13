import { createCommand } from 'commander';

import * as log from '../log';
import { loadConfig } from '../config';

import { executeIntegrationLocally } from '../../framework/execution';

export function collect() {
  return createCommand('collect')
    .description(
      'Executes the integration and stores the collected data to disk',
    )
    .action(async () => {
      const config = await loadConfig();

      log.info('\nConfiguration loaded! Running integration...\n');

      const results = await executeIntegrationLocally(config);
      log.displayExecutionResults(results);
    });
}
