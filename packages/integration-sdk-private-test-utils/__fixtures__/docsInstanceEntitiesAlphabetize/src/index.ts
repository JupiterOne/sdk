import fetchDataSteps from './steps/fetchData';
import {
  IntegrationInvocationConfig,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';

export const invocationConfig: IntegrationInvocationConfig<IntegrationInstanceConfig> =
  {
    instanceConfigFields: {},
    integrationSteps: [fetchDataSteps],
  };
