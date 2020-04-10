import { IntegrationStep, GetStepStartStatesFunction } from './step';

import { InvocationValidationFunction } from './validation';

export interface IntegrationInvocationConfig {
  instanceConfigFields?: IntegrationInstanceConfigFieldMap;
  validateInvocation?: InvocationValidationFunction;
  getStepStartStates?: GetStepStartStatesFunction;
  integrationSteps: IntegrationStep[];
}

export interface IntegrationInstanceConfigField {
  type?: 'string' | 'boolean';
  mask?: boolean;
}

export type IntegrationInstanceConfigFieldMap = Record<
  string,
  IntegrationInstanceConfigField
>;
