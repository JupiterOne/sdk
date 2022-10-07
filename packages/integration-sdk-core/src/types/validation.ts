import {
  ExecutionContext,
  IntegrationExecutionConfig,
  IntegrationExecutionContext,
} from './context';
import { IntegrationInstanceConfig } from './instance';

export type InvocationValidationFunction<T extends ExecutionContext> = (
  context: T,
) => Promise<void> | void;

export type IntegrationInvocationValidationFunction<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> = InvocationValidationFunction<
  IntegrationExecutionContext<TInstanceConfig, TExecutionConfig>
>;
