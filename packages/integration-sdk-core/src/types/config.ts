import { IntegrationInstanceConfig } from './instance';
import { GetStepStartStatesFunction, Step } from './step';
import { InvocationValidationFunction } from './validation';
import {
  ExecutionContext,
  IntegrationExecutionContext,
  StepExecutionContext,
  IntegrationStepExecutionContext,
} from './context';

export type KeyNormalizationFunction = (_key: string) => string;

export interface InvocationConfigOptions {
  /**
   * Normalization transform for tracking keys in an integration. Allows
   * entities to be tracked and looked up using the provided transformation.
   * One use case of this normalization function is to track duplicates
   * among case-insensitive keys.
   *
   * Example:
   *   (_key: string) => _key.toLowerCase()
   */
  keyNormalizationFunction?: KeyNormalizationFunction;
}

export interface InvocationConfig<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
> {
  validateInvocation?: InvocationValidationFunction<TExecutionContext>;
  getStepStartStates?: GetStepStartStatesFunction<TExecutionContext>;
  integrationSteps: Step<TStepExecutionContext>[];
  invocationConfigOptions?: InvocationConfigOptions;
}

export interface IntegrationInvocationConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>
  extends InvocationConfig<
    IntegrationExecutionContext<TConfig>,
    IntegrationStepExecutionContext<TConfig>
  > {
  instanceConfigFields?: IntegrationInstanceConfigFieldMap<TConfig>;
}

export interface IntegrationInstanceConfigField {
  type?: 'string' | 'boolean';
  mask?: boolean;
}

export type IntegrationInstanceConfigFieldMap<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = Record<keyof TConfig, IntegrationInstanceConfigField>;
