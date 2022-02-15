import {
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';

export interface StepTestConfig<
  TInvocationConfig extends IntegrationInvocationConfig = IntegrationInvocationConfig
> {
  stepId: string;
  invocationConfig: TInvocationConfig;
}

export interface StepTestConfigWithCredentials<
  TInvocationConfig extends IntegrationInvocationConfig = IntegrationInvocationConfig,
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends StepTestConfig<TInvocationConfig> {
  instanceConfig: TInstanceConfig;
}
