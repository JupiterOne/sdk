import { IntegrationInvocationConfig } from './config';
import { IntegrationStepExecutionContext } from './context';
import { IntegrationInstanceConfig } from './instance';
import { Step } from './step';

export interface StepSpec<TConfig extends IntegrationInstanceConfig>
  extends Omit<
    Step<IntegrationStepExecutionContext<TConfig>>,
    'executionHandler'
  > {
  implemented: boolean;
}

export interface IntegrationSpecConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends Omit<IntegrationInvocationConfig, 'integrationSteps'> {
  integrationSteps: StepSpec<TConfig>[];
}
