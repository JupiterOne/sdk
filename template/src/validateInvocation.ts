import {
  IntegrationExecutionContext,
  IntegrationProviderAuthenticationError,
  IntegrationValidationError,
} from '@jupiterone/integration-sdk';

import { IntegrationConfig } from './types';

export default async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>,
) {
  const { config } = context.instance;

  if (!config.clientId || !config.clientSecret) {
    throw new IntegrationValidationError(
      'Config requires all of {clientId, clientSecret}',
    );
  }

  const apiClient = createAPIClient(config);
  try {
    await apiClient.verifyAuthentication();
  } catch (err) {
    throw new IntegrationProviderAuthenticationError({
      cause: err,
      endpoint: 'https://provider.com/api/v1/some/endpoint?limit=1',
      status: err.status,
      statusText: err.statusText,
    });
  }
}
