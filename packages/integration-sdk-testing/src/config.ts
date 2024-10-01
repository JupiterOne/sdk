import {
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  IntegrationStep,
} from '@jupiterone/integration-sdk-core';

export interface StepTestConfig<
  TInvocationConfig extends
    IntegrationInvocationConfig = IntegrationInvocationConfig,
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
> {
  stepId: string;
  dependencyStepIds?: string[];
  invocationConfig: TInvocationConfig;
  instanceConfig: TInstanceConfig;
  onBeforeExecuteStep?: (step: IntegrationStep) => void;
  onAfterExecuteStep?: (step: IntegrationStep) => void;
}
