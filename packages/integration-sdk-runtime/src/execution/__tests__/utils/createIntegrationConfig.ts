import {
  IntegrationInvocationValidationFunction,
  IntegrationInvocationConfig,
  IntegrationInstanceConfig,
  IntegrationInstance,
} from '@jupiterone/integration-sdk-core';
import { LOCAL_INTEGRATION_INSTANCE } from '../..';
import { createIntegrationLogger } from '../../..';
import { InstanceConfigurationData } from '../executeIntegration.test';

export function createInstanceConfiguration<
  TIntegrationConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>(
  options?: Partial<InstanceConfigurationData<TIntegrationConfig>>,
): InstanceConfigurationData<TIntegrationConfig> {
  const validateInvocation: IntegrationInvocationValidationFunction<TIntegrationConfig> =
    options?.validateInvocation || jest.fn();

  const invocationConfig: IntegrationInvocationConfig<TIntegrationConfig> = {
    validateInvocation,
    integrationSteps: [],
    ...options?.invocationConfig,
  };

  return {
    validateInvocation,
    invocationConfig,
    instance: LOCAL_INTEGRATION_INSTANCE as IntegrationInstance<
      TIntegrationConfig
    >,
    logger: createIntegrationLogger({
      name: 'integration-name',
      invocationConfig,
    }),
    ...options,
  };
}
