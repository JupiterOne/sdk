import {
  Entity,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { StepTestConfig } from './config';
import { executeStepWithDependencies } from './executeStepWithDependencies';
import { setupRecording, SetupRecordingInput } from './recording';

export type WithRecordingParams = SetupRecordingInput;

export async function withRecording(
  withRecordingParams: WithRecordingParams,
  cb: () => Promise<void>,
) {
  const recording = setupRecording(withRecordingParams);

  try {
    await cb();
  } finally {
    await recording.stop();
  }
}

type AfterStepCollectionExecutionParams = {
  stepConfig: StepTestConfig<
    IntegrationInvocationConfig<IntegrationInstanceConfig>,
    IntegrationInstanceConfig
  >;
  stepResult: {
    collectedEntities: Entity[];
    collectedRelationships: Relationship[];
    collectedData: {
      [key: string]: any;
    };
    encounteredTypes: string[];
  };
};

type CreateStepCollectionTestParams = {
  recordingSetup: WithRecordingParams;
  stepConfig: StepTestConfig;
  afterExecute?: (params: AfterStepCollectionExecutionParams) => Promise<void>;
};

/**
 * createStepCollectionTest creates a step collection test using a recording.
 * The step collection test verifies that at least one of all declared entities
 * and direct relationships are found in the collected data.
 *
 * NOTE: Mapped relationships are currently not supported
 */
export function createStepCollectionTest({
  recordingSetup,
  stepConfig,
  afterExecute,
}: CreateStepCollectionTestParams) {
  return async () => {
    await withRecording(recordingSetup, async () => {
      const stepResult = await executeStepWithDependencies(stepConfig);

      expect(stepResult).toMatchStepMetadata(stepConfig);

      if (afterExecute) await afterExecute({ stepResult, stepConfig });
    });
  };
}
