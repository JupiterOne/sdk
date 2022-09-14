import { getApiBaseUrl } from '@jupiterone/integration-sdk-runtime';

/**
 * Determines the JupiterOne `apiBaseUrl` based on these mutually-exclusive `options`:
 * - --api-base-url - a specific URL to use
 * - --development - use the development API
 *
 * @throws Error if both --api-base-url and --development are specified
 */
export function getApiBaseUrlOption(options: any): string {
  let apiBaseUrl: string;
  if (options.apiBaseUrl) {
    if (options.development) {
      throw new Error(
        'Invalid configuration supplied.  Cannot specify both --api-base-url and --development(-d) flags.',
      );
    }
    apiBaseUrl = options.apiBaseUrl;
  } else {
    apiBaseUrl = getApiBaseUrl({
      dev: options.development,
    });
  }
  return apiBaseUrl;
}

interface SynchronizationJobSourceOptions {
  source: 'integration-managed' | 'integration-external' | 'api';
  scope?: string;
  integrationInstanceId?: string;
}

/**
 * Determines the `source` configuration for the synchronization job based on these `options`:
 * - --source - a specific source to use
 * - --scope - a specific scope to use, required when --source is "api"
 * - --integrationInstanceId - a specific integrationInstanceId to use, required when --source is not "api"
 */
export function getSynchronizationJobSourceOptions(
  options: any,
): SynchronizationJobSourceOptions {
  const synchronizeOptions: SynchronizationJobSourceOptions = {
    source: options.source,
  };
  if (options.source === 'api') {
    if (options.integrationInstanceId)
      throw new Error(
        'Invalid configuration supplied. Cannot specify both --source api and --integrationInstanceId flags.',
      );
    if (!options.scope)
      throw new Error(
        'Invalid configuration supplied. --source api requires --scope flag.',
      );
    synchronizeOptions.scope = options.scope;
  } else if (
    !['integration-managed', 'integration-external'].includes(options.source)
  ) {
    throw new Error(
      `Invalid configuration supplied. --source must be one of: integration-managed, integration-external, api. Received: ${options.source}.`,
    );
  } else if (options.integrationInstanceId) {
    synchronizeOptions.integrationInstanceId = options.integrationInstanceId;
  } else {
    throw new Error(
      'Invalid configuration supplied. --integrationInstanceId or --source api and --scope required.',
    );
  }
  return synchronizeOptions;
}
