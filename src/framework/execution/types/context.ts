import { IntegrationInstance, IntegrationInstanceConfig } from './instance';
import { JobState } from './jobState';
import { IntegrationLogger } from './logger';

export interface ExecutionContext {
  logger: IntegrationLogger<StepExecutionContext>;
}

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export interface IntegrationExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends ExecutionContext {
  instance: IntegrationInstance<TConfig>;
}

export interface StepExecutionContext extends ExecutionContext {
  jobState: JobState;
}

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export interface IntegrationStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends IntegrationExecutionContext<TConfig>, StepExecutionContext {}
