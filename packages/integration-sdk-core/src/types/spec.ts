import { IntegrationInvocationConfig } from './config';
import {
  IntegrationExecutionConfig,
  IntegrationStepExecutionContext,
} from './context';
import { IntegrationInstanceConfig } from './instance';
import { Step } from './step';

export interface StepSpec<
  TInstanceConfig extends IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig,
> extends Omit<
    Step<IntegrationStepExecutionContext<TInstanceConfig, TExecutionConfig>>,
    'executionHandler'
  > {
  implemented: boolean;
}

export interface IntegrationSpecConfig<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> extends Omit<IntegrationInvocationConfig, 'integrationSteps'> {
  integrationSteps: StepSpec<TInstanceConfig, TExecutionConfig>[];
}
