import { StepStartStates } from '@jupiterone/integration-sdk-core';
import { DisabledStepReason } from '@jupiterone/integration-sdk-core';
import { Step } from '@jupiterone/integration-sdk-core';
import { StepExecutionContext } from '@jupiterone/integration-sdk-core';

/*
 * Disable steps related to an "ingestionSourceId" that is present in the instance's "disabledSources" array.
 * Prioritizes the step state configured in the integration's "getStepStartStates" property.
 *
 * @param {Step<StepExecutionContext>[]} input.integrationSteps - The integration steps.
 * @param {StepStartStates} input.configStepStartStates - The step start states configured in the integration.
 * @param {string[]} input.disabledSources - The ingestion source ids that should be disabled.
 * @returns {StepStartStates}
 */
export function getIngestionSourceStepStartStates<
  TStepExecutionContext extends StepExecutionContext,
>({
  integrationSteps,
  configStepStartStates,
  disabledSources,
}: {
  integrationSteps: Step<TStepExecutionContext>[];
  configStepStartStates: StepStartStates;
  disabledSources?: string[];
}): StepStartStates {
  const ingestionSourceStepStates: StepStartStates = {};
  for (const step of integrationSteps) {
    if (configStepStartStates[step.id].disabled) {
      ingestionSourceStepStates[step.id] = configStepStartStates[step.id];
      continue;
    }

    const isSourceDisabled = step.ingestionSourceId
      ? Boolean(disabledSources?.includes(step.ingestionSourceId))
      : false;
    ingestionSourceStepStates[step.id] = {
      disabled: isSourceDisabled,
      ...(isSourceDisabled && {
        disabledReason: DisabledStepReason.USER_CONFIG,
      }),
      ...('stepCachePath' in configStepStartStates[step.id] && {
        stepCachePath: configStepStartStates[step.id].stepCachePath,
      }),
    };
  }
  return ingestionSourceStepStates;
}
