import { IntegrationExecutionContext } from './context';

export type InvocationValidationFunction = (
  context: IntegrationExecutionContext,
) => Promise<void> | void;
