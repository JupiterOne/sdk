import { createCommand } from 'commander';

import * as log from '../../log';

import {
  executeIntegrationLocally,
  IntegrationStepStartStates,
} from '../../framework';
import { loadConfig } from '../../framework/config';

export function collect() {
  return createCommand('collect')
    .description(
      'Executes the integration and stores the collected data to disk',
    )
    .option('-s, --step <steps>', 'step(s) to run, comma separated if multiple')
    .action(async (options) => {
      const config = await loadConfig();
      const allStepIds = config.integrationSteps.map((step) => step.id);
      const stepsToRun = (options.step
        ? [...options.step.split(',')]
        : []
      ).filter((step) => step !== undefined && step !== null);

      const originalGetStepStartStates =
        config.getStepStartStates ?? (() => ({}));

      config.getStepStartStates = stepsToRun.length
        ? (ctx) => {
            const originalEnabledRecord = originalGetStepStartStates(ctx);
            const enabledRecord: IntegrationStepStartStates = {};
            for (const stepId of allStepIds) {
              const originalValue = originalEnabledRecord[stepId] ?? {};
              if (stepsToRun.includes(stepId)) {
                enabledRecord[stepId] = {
                  ...originalValue,
                  disabled: false,
                };
              } else {
                enabledRecord[stepId] = {
                  ...originalValue,
                  disabled: true,
                };
              }
            }
            return enabledRecord;
          }
        : originalGetStepStartStates;
      log.info('\nConfiguration loaded! Running integration...\n');

      const results = await executeIntegrationLocally(config);
      log.displayExecutionResults(results);
    });
}
