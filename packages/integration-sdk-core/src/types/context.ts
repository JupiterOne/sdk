import { IntegrationInstance, IntegrationInstanceConfig } from './instance';
import { JobState } from './jobState';
import { IntegrationLogger } from './logger';

export type Execution = {
  startedOn: number;
  endedOn?: number;
};

export type ExecutionHistory = {
  current: Execution;
  previous?: Execution;
  lastSuccessful?: Execution;
};

export interface ExecutionContext {
  logger: IntegrationLogger;
  executionHistory: ExecutionHistory;
}

/**
 * A configuration object constructed by an integration just before the
 * integration is executed. This is distinct from the
 * `IntegrationInstanceConfig`, containing dynamic values perhaps calculated
 * based on the instance config.
 */
export type IntegrationExecutionConfig = object;

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export type IntegrationLoadExecutionConfigContext<
  TConfig extends IntegrationInstanceConfig,
> = ExecutionContext & {
  instance: IntegrationInstance<TConfig>;
};

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 * @param TExecutionConfig the configuration type produced by the
 * integration's optional `loadExecutionConfig` function
 */
export type IntegrationExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> = IntegrationLoadExecutionConfigContext<TConfig> & {
  executionConfig: TExecutionConfig;
};

export type StepExecutionContext = ExecutionContext & {
  jobState: JobState;
};

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 * @param TExecutionConfig the configuration type produced by the
 * integration's optional `loadExecutionConfig` function
 */
export interface IntegrationStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> extends IntegrationExecutionContext<TConfig, TExecutionConfig>,
    StepExecutionContext {}
