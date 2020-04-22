import { createCommand } from 'commander';

import * as log from '../../log';

import { buildStepDependencyGraph } from '../../framework/execution/dependencyGraph';
import {
  executeIntegrationLocally,
  IntegrationStepStartStates,
} from '../../framework';
import { loadConfig } from '../../framework/config';

// coercion function to collect multiple values for a flag
const collecter = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

export function collect() {
  return createCommand('collect')
    .description(
      'Executes the integration and stores the collected data to disk',
    )
    .option(
      '-s, --step <steps>',
      'step(s) to run, comma separated if multiple',
      collecter,
      [],
    )
    .action(async (options) => {
      const config = await loadConfig();

      const allStepIds = config.integrationSteps.map((step) => step.id);

      const stepsToRun: string[] = (options.step ? options.step : []).filter(
        (step: string | undefined | null) =>
          step !== undefined && step !== null,
      );
      // build out the dependecy graph so we can
      // enable the dependencies of the steps
      // we want to run.
      const depGraph = buildStepDependencyGraph(config.integrationSteps);
      const dependentSteps: string[] = [];
      for (const step of stepsToRun) {
        const dependencies = depGraph.dependenciesOf(step);
        dependentSteps.push(...dependencies);
      }
      stepsToRun.push(...dependentSteps);

      const originalGetStepStartStates = config.getStepStartStates;

      config.getStepStartStates = stepsToRun.length
        ? (ctx) => {
            const originalEnabledRecord =
              originalGetStepStartStates?.(ctx) ?? {};
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
