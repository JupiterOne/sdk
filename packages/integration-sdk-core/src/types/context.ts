import {
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationExecutionConfig,
} from './instance';
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
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export type IntegrationLoadExecutionConfigContext<
  TConfig extends IntegrationInstanceConfig
> = ExecutionContext & {
  instance: IntegrationInstance<TConfig>;
};

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
 */
export interface IntegrationStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig
> extends IntegrationExecutionContext<TConfig, TExecutionConfig>,
    StepExecutionContext {}
