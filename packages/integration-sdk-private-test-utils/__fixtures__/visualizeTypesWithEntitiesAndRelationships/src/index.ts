import fetchAccountsStep from './steps/fetchAccounts';
import {
  IntegrationInvocationConfig,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';

export const invocationConfig: IntegrationInvocationConfig<IntegrationInstanceConfig> =
  {
    instanceConfigFields: {},
    integrationSteps: [fetchAccountsStep],
  };
