import { ExecutionContext, IntegrationExecutionContext } from './context';
import { IntegrationInstanceConfig } from './instance';

export type InvocationValidationFunction<T extends ExecutionContext> = (
  context: T,
) => Promise<void> | void;

// TODO: This shouldn't be necessary anymore
export type IntegrationInvocationValidationFunction<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = InvocationValidationFunction<IntegrationExecutionContext<TConfig>>;
