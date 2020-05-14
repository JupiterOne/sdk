import { IntegrationInstanceConfig } from './instance';
import { GetStepStartStatesFunction, IntegrationStep } from './step';
import { InvocationValidationFunction } from './validation';

export interface IntegrationInvocationConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> {
  instanceConfigFields?: IntegrationInstanceConfigFieldMap;
  validateInvocation?: InvocationValidationFunction<TConfig>;
  getStepStartStates?: GetStepStartStatesFunction<TConfig>;
  integrationSteps: IntegrationStep<TConfig>[];
}

export interface IntegrationInstanceConfigField {
  type?: 'string' | 'boolean';
  mask?: boolean;
}

export type IntegrationInstanceConfigFieldMap = Record<
  string,
  IntegrationInstanceConfigField
>;
