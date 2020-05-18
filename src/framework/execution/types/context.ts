import { IntegrationInstance, IntegrationInstanceConfig } from './instance';
import { JobState } from './jobState';
import { IntegrationLogger } from './logger';

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export interface IntegrationExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> {
  instance: IntegrationInstance<TConfig>;
  logger: IntegrationLogger;
}

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export interface IntegrationStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends IntegrationExecutionContext<TConfig> {
  jobState: JobState;
}
