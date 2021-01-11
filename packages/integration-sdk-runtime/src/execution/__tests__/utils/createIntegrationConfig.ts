import {
  IntegrationInvocationValidationFunction,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';
import { LOCAL_INTEGRATION_INSTANCE } from '../..';
import { createIntegrationLogger } from '../../..';
import { InstanceConfigurationData } from '../executeIntegration.test';

export function createInstanceConfiguration(
  options?: Partial<InstanceConfigurationData>,
): InstanceConfigurationData {
  const validateInvocation: IntegrationInvocationValidationFunction =
    options?.validateInvocation || jest.fn();

  const invocationConfig: IntegrationInvocationConfig = {
    validateInvocation,
    integrationSteps: [],
    ...options?.invocationConfig,
  };

  return {
    validateInvocation,
    invocationConfig,
    instance: LOCAL_INTEGRATION_INSTANCE,
    logger: createIntegrationLogger({
      name: 'integration-name',
      invocationConfig,
    }),
    ...options,
  };
}
