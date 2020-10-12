import {
  ExecutionContext,
  IntegrationExecutionContext,
  IntegrationStepExecutionContext,
  StepExecutionContext,
} from './context';
import { IntegrationInstanceConfig } from './instance';
import { GetStepStartStatesFunction, Step } from './step';
import { GetSynchronizationModeFunction } from './synchronization';
import { InvocationValidationFunction } from './validation';

export interface InvocationConfig<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext
> {
  validateInvocation?: InvocationValidationFunction<TExecutionContext>;
  getSyncMode?: GetSynchronizationModeFunction<TExecutionContext>;
  getStepStartStates?: GetStepStartStatesFunction<TExecutionContext>;
  integrationSteps: Step<TStepExecutionContext>[];
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
