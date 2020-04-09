import { IntegrationStep } from './step';

export interface IntegrationInvocationConfig {
  instanceConfigFields: IntegrationInstanceConfigFieldMap;
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
