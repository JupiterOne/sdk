import {
  IntegrationExecutionConfig,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  IntegrationInvocationValidationFunction,
} from '@jupiterone/integration-sdk-core';
import { LOCAL_INTEGRATION_INSTANCE } from '../..';
import { createIntegrationLogger } from '../../..';
import { InstanceConfigurationData } from '../executeIntegration.test';

export function createInstanceConfiguration<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
>(
  options?: Partial<
    InstanceConfigurationData<TInstanceConfig, TExecutionConfig>
  >,
): InstanceConfigurationData<TInstanceConfig, TExecutionConfig> {
  const validateInvocation: IntegrationInvocationValidationFunction<
    TInstanceConfig,
    TExecutionConfig
  > = options?.validateInvocation || jest.fn();

  const invocationConfig: IntegrationInvocationConfig<
    TInstanceConfig,
    TExecutionConfig
  > = {
    validateInvocation,
    integrationSteps: [],
    ...options?.invocationConfig,
  };

  return {
    validateInvocation,
    invocationConfig,
    instance:
      LOCAL_INTEGRATION_INSTANCE as IntegrationInstance<TInstanceConfig>,
    logger: createIntegrationLogger({
      name: 'integration-name',
      invocationConfig,
    }),
    ...options,
  };
}
