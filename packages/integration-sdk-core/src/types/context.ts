import { IntegrationInstance, IntegrationInstanceConfig } from './instance';
import { JobState } from './jobState';
import { IntegrationLogger } from './logger';

export type Execution = {
  startedOn: number;
  endedOn?: number;
};

export type ExecutionHistory = {
  lastExecution: Execution;
  lastSuccessfulExecution?: Execution;
};

export interface ExecutionContext {
  logger: IntegrationLogger;
  history?: ExecutionHistory;
}

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export type IntegrationExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = ExecutionContext & {
  instance: IntegrationInstance<TConfig>;
};

export type StepExecutionContext = ExecutionContext & {
  jobState: JobState;
};

/**
 * @param TConfig the integration specific type of the `instance.config`
 * property
 */
export interface IntegrationStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends IntegrationExecutionContext<TConfig>, StepExecutionContext {}
