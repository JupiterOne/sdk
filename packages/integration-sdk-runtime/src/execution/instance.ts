import {
  IntegrationInstance,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';

import { loadConfigFromEnvironmentVariables } from './config';

export const LOCAL_INTEGRATION_INSTANCE: IntegrationInstance = {
  id: 'local-integration-instance',
  accountId: 'Your account',
  name: 'Local Integration',
  integrationDefinitionId: 'local-integration-definition',
  description: 'A generated integration instance for local execution',
  config: {},
} as const;

/**
 * Parses the DISABLED_INGESTION_SOURCES environment variable.
 * Expects a comma-separated list of ingestion source IDs, e.g. "permissions,vulnerabilities"
 */
function parseDisabledIngestionSourcesFromEnv():
  | { ingestionSourceId: string }[]
  | undefined {
  const raw = process.env.DISABLED_INGESTION_SOURCES;
  if (!raw) return undefined;

  const sourceIds = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (sourceIds.length === 0) return undefined;

  return sourceIds.map((ingestionSourceId) => ({ ingestionSourceId }));
}

export function createIntegrationInstanceForLocalExecution(
  config: IntegrationInvocationConfig,
): IntegrationInstance {
  return {
    id: process.env.INTEGRATION_INSTANCE_ID || LOCAL_INTEGRATION_INSTANCE.id,
    name:
      process.env.INTEGRATION_INSTANCE_NAME || LOCAL_INTEGRATION_INSTANCE.name,
    integrationDefinitionId:
      process.env.INTEGRATION_INSTANCE_INTEGRATION_DEFINITION_ID ||
      LOCAL_INTEGRATION_INSTANCE.integrationDefinitionId,
    description:
      process.env.INTEGRATION_INSTANCE_DESCRIPTION ||
      LOCAL_INTEGRATION_INSTANCE.description,

    accountId:
      process.env.INTEGRATION_INSTANCE_ACCOUNT_ID ||
      process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID ||
      LOCAL_INTEGRATION_INSTANCE.accountId,
    config: config.instanceConfigFields
      ? loadConfigFromEnvironmentVariables(config.instanceConfigFields)
      : {},
    disabledSources: parseDisabledIngestionSourcesFromEnv(),
  };
}
