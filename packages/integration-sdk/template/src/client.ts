import { IntegrationProviderAuthenticationError } from '@jupiterone/integration-sdk';

import { IntegrationConfig } from './types';

export type ResourceIteratee = <T>(each: T) => Promise<void> | void;

/**
 * An APIClient maintains authentication state and provides an interface to
 * third party data APIs.
 *
 * It is recommended that integrations wrap provider data APIs to provide a
 * place to handle error responses and implement common patterns for iterating
 * resources.
 */
export class APIClient {
  constructor(readonly config: IntegrationConfig) {}

  public async verifyAuthentication(): Promise<void> {
    try {
      // TODO make the most light-weight request possible to validate
      // authentication works with the provided credentials, throw an err if
      // authentication fails
    } catch (err) {
      throw new IntegrationProviderAuthenticationError({
        cause: err,
        endpoint: 'https://provider.com/api/v1/some/endpoint?limit=1',
        status: err.status,
        statusText: err.statusText,
      });
    }
  }

  /**
   * Iterates each instance of a type of resource in the provider data APIs.
   *
   * The provider API will hopefully support pagination. Functions like this
   * should maintain pagination state, and for each page, for each record in
   * the page, invoke the `ResourceIteratee`. This will encourage a pattern
   * where each resource is processed and dropped from memory.
   *
   * @param iteratee receives each resource and produces entities/relationships
   */
  public async iterateSomething(iteratee: ResourceIteratee): Promise<void> {
    // TODO paginate an endpoint, invoke the iteratee with each record in the page
  }
}

export function createAPIClient(config: IntegrationConfig): APIClient {
  return new APIClient(config);
}
