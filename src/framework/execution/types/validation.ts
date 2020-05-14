import { IntegrationExecutionContext } from './context';
import { IntegrationInstanceConfig } from './instance';

export type InvocationValidationFunction<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = (context: IntegrationExecutionContext<TConfig>) => Promise<void> | void;
