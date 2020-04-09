import { IntegrationInstance, IntegrationInvocationConfig } from './types';
import { loadConfigFromEnvironmentVariables } from './config';

export const LOCAL_INTEGRATION_INSTANCE: IntegrationInstance = {
  id: 'local-integration-instance',
  accountId: 'Your account',
  name: 'Local Integration',
  integrationDefinitionId: 'local-integration-definition',
  description: 'A generated integration instance for local execution',
  config: undefined,
} as const;

export async function fetchIntegrationInstance(
  config: IntegrationInvocationConfig,
  integrationInstanceId?: string,
): Promise<IntegrationInstance> {
  return integrationInstanceId
    ? await fetchIntegrationInstanceFromJupiterOne(integrationInstanceId)
    : createIntegrationInstanceForLocalExecution(config);
}

export async function fetchIntegrationInstanceFromJupiterOne(
  integrationInstanceId: string,
): Promise<IntegrationInstance> {
  throw new Error('Not implemented yet.');
}

export function createIntegrationInstanceForLocalExecution(
  config: IntegrationInvocationConfig,
): IntegrationInstance {
  return {
    ...LOCAL_INTEGRATION_INSTANCE,
    config: config.instanceConfigFields
      ? loadConfigFromEnvironmentVariables(config.instanceConfigFields)
      : undefined,
  };
}
