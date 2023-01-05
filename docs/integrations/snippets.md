# Integration Snippets

With the purpose of helping the development of new integrations, we have created
some code "snippets" that can be used in new or existing integrations. If you
are using VSCode as source code editor, please follow
[the guide](../../snippets/integrations/README.md) to install and use the
available snippets

If you are not using VSCode, you can copy and paste the following code snippets
for each case described.

1. **Integration step**: Snippet used to create a new integration step

```typescript
export const userStep: IntegrationStep<IntegrationConfig>[] = [
  {
    /**
     * Points to a constant in src/step/constants.ts
     */
    id: Steps.USERS,
    /**
     * Friendly name that will be displayed in debug logs
     * and to customers in the job event log.
     */
    name: 'Fetch Users',
    /**
     * Metadata about the entities ingested in this integration step. This is
     * used to generate documentation.
     * Points to a constant in src/steps/constants.ts
     */
    entities: [Entities.USER],
    /**
     * Metadata about the relationships ingested in this integration step. This is
     * used to generate documentation.
     */
    relationships: [],
    /**
     * Metadata about any mapped relationships ingested in this integration step. This is
     * used to generate documentation.
     */
    mappedRelationships: [],
    /**
     * An optional array of other step ids that need to execute
     * before the current step can.
     */
    dependsOn: [],
    /**
     * Function that runs to perform the step
     */
    executionHandler:
      fetchUsers /* Use j1-exec-handler snippet to generate this function and call it here */,
  },
];
```

2. **Static Execution Handler**: Snippet used to create an execution handler
   with static data

```typescript
import { createAccountEntity } from './converter';

export const ACCOUNT_ENTITY_KEY = 'entity:account';

// TODO: Modify this comment with an explanation that reflects the purpose of this executionHandler
/**
 * The executionHandler is where the work for the step happens.
 * The executionHandler is a function that takes in the IntegrationStepExecutionContext
 * as a parameter and performs the necessary work to create entities and relationships.
 */
export async function fetchAccountDetails({
  instance,
  jobState,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const accountEntity = await jobState.addEntity(createAccountEntity());

  await jobState.setData(ACCOUNT_ENTITY_KEY, accountEntity);
}
```

3. **Execution Handler**: Snippet used to create an execution handler that
   performs an API call to add multiple entities and/or relationships

```typescript
import { createAPIClient } from '../../client';
import { createRoleEntity, createUserRoleRelationship } from './converter';

// TODO: Modify this comment with an explanation that reflects the purpose of this executionHandler
/**
 * The executionHandler is where the work for the step happens.
 * The executionHandler is a function that takes in the IntegrationStepExecutionContext
 * as a parameter and performs the necessary work to create entities and relationships.
 */
export async function fetchRoles({
  instance,
  jobState,
  logger,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const apiClient = createAPIClient(instance.config, logger);

  const userEntity = (await jobState.getData(USER_ENTITY_KEY)) as Entity;

  await apiClient.iterateRoles(async (role) => {
    const roleEntity = await jobState.addEntity(createRoleEntity(role));
    // Add relationship between user and role
    await jobState.addRelationship(
      createUserRoleRelationship(userEntity, roleEntity),
    );
  });
}
```

4. **Converter**: Snippet used to create a converter

```typescript
import {
  createIntegrationEntity,
  Entity,
} from '@jupiterone/integration-sdk-core';
import { DigitalOceanUser } from '../../types';

import { Entities } from '../constants';

// TODO: Modify this comment with an explanation that reflects the purpose of this converter
/**
 *  Different providers will present data in many different ways.
 *  We want to normalize our data to be more consistent, so we can gather
 *  useful insights from it. The converter will create the normalized entity
 *  or relationship from the raw data the provider gives in an API response.
 * @param user
 * @returns Normalized J1 DigitalOcean user
 */

export function createUserEntity(user: DigitalOceanUser): Entity {
  return createIntegrationEntity({
    entityData: {
      source: user,
      assign: {
        _key: user.uuid,
        _type: Entities.USER._type,
        _class: Entities.USER._class,
        name: 'User',
        /** Add more fields */
        email: user.email,
      },
    },
  });
}
```

5. **Step Spec**: Snippet used to creates the spec of a new step

```typescript
export const userSpec: StepSpec<IntegrationConfig>[] = [
  {
    /**
     * ENDPOINT: https://api.datadog.com/api/v1/users
     * PATTERN: Fetch Entities
     */
    id: 'fetch-users',
    name: 'Fetch Users',
    entities: [
      {
        resourceName: 'User',
        _type: 'datadog_user',
        _class: ['User'],
      },
    ],
    relationships: [],
    mappedRelationships: [],
    dependsOn: [],
    implemented: true,
  },
];
```

6. **Entity Metadata**: Snippet used to add metadata of an entity

```typescript
{
  resourceName: 'User',
  _type: 'datadog_user',
  _class: ['User']
},
```

7. **Relationship Metadata**: Snippet used to add metadata of a relationship

```typescript
{
  sourceType: 'datadog_account',
  targetType: 'datadog_user',
  _type: 'datadog_account_has_user',
  _class: RelationshipClass.HAS,
},
```

8. **Pagination**: Snippet used to add a paginated request

```typescript

import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import { IntegrationError } from '@jupiterone/integration-sdk-core';
import { URLSearchParams } from 'url';

export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
export interface ProviderResponse<T> extends NodeFetchResponse {
  json(): Promise<T>;
}

const ITEMS_PER_PAGE = 1000;

export class APIClient {
  ...
  /**
   * Iterates each user resource in the provider.
   *
   * @param iteratee receives each resource to produce entities/relationships
   */
  public async iterateUsers(iteratee: ResourceIteratee<User>): Promise<void> {
    let currentPage = 1,
      totalPages = 0;

    do {
      const response = await this.fetchUsers(currentPage, ITEMS_PER_PAGE);
      const result = await response.json();

      // Get total pages via response
      totalPages = result.paging.totalPages;
      /* Get total pages via response header
      totalPages = parseInt(
        response.headers.get('X-Total-Pages') as string,
        10,
      );
      */

      if (Array.isArray(result.data)) {
        for (const resource of result.data) {
          await iteratee(resource);
        }
      } else {
        throw new IntegrationError({
          code: 'UNEXPECTED_RESPONSE_DATA',
          message: `Expected a collection of resources but type was ${typeof result}`,
        });
      }

      // Increase currentPage
      currentPage++;
    } while (currentPage <= totalPages);
  }

  private async fetchUsers(page: number, pageSize: number) {
    const searchParams = new URLSearchParams({
      page: page.toString(),
      pageSize: ITEMS_PER_PAGE.toString(),
    });
    const endpoint = `/api/v1/users?${searchParams.toString()}`;

    return this.request<ProviderResponse>(endpoint, 'get'); // use j1-request-with-retries to generate this method
  }

  ...
}
```

9. **Rate Limiting**: Snippet used to adds logic to handle rate limits in a
   client

```typescript
import fetch, { Response as NodeFetchResponse } from 'node-fetch';
import { sleep } from '@lifeomic/attempt'

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: number;
}

export interface ProviderResponse<T> extends NodeFetchResponse {
  json(): Promise<T>;
}

export class APIClient {
  ...
  private rateLimitStatus: RateLimitStatus;

  /**
   * Pulls rate limit headers from response.
   * @param response
   * @private
   */
  private setRateLimitStatus<T>(response: ProviderResponse<T>) {
    // X-RateLimit-Limit: Request limit per hour
    const limit = response.headers.get('X-RateLimit-Limit');
    // X-RateLimit-Remaining: The number of requests left for the time window
    const remaining = response.headers.get('X-RateLimit-Remaining');
    // X-RateLimit-Reset: The remaining window before the rate limit resets in UTC epoch seconds
    const reset = response.headers.get('X-RateLimit-Reset');

    if (limit && remaining && reset) {
      this.rateLimitStatus = {
        limit: Number(limit),
        remaining: Number(remaining),
        reset: Number(reset),
      };
    }

    this.logger.info(this.rateLimitStatus, 'Rate limit status.');
  }

  /**
   * Determines if approaching the rate limit, sleeps until rate limit has reset.
   * Use this function whenever you want to check the rate limit of your API
   * Example: await this.checkRateLimitStatus();
   */
  private async checkRateLimitStatus() {
    if (this.rateLimitStatus) {
      const rateLimitRemainingProportion =
        this.rateLimitStatus.remaining / this.rateLimitStatus.limit;
      const msUntilRateLimitReset = this.rateLimitStatus.reset - Date.now();

      if (rateLimitRemainingProportion <= 0.1 && msUntilRateLimitReset > 0) {
        this.logger.info(
          {
            rateLimitStatus: this.rateLimitStatus,
            msUntilRateLimitReset,
            rateLimitRemainingProportion,
          },
          `Reached rate limits, sleeping now.`,
        );
        await sleep(msUntilRateLimitReset);
      }
    }
  }

  ...
}
```

10. **Request with retries**: Snippet used to add a new method to perform API
    requests with retries and/or rate limit checks

```typescript
import fetch, { RequestInit, Response as NodeFetchResponse } from 'node-fetch';
import { retry } from '@lifeomic/attempt';
import {
  IntegrationProviderAPIError,
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
} from '@jupiterone/integration-sdk-core';

export interface ProviderResponse<T> extends NodeFetchResponse {
  json(): Promise<T>;
}

export enum Method {
  GET = 'get',
  POST = 'post'
}

export class APIClient {
  ...
  private readonly BASE_URL = 'https://api.provider.com'
  private readonly headers: RequestInit['headers'];

  private async request<T>(
    endpoint: string,
    method: Method,
    body?: {},
  ): Promise<ProviderResponse<T>> {
    const requestAttempt = async () => {
      // Check rate limit status before each request
      // await this.checkRateLimitStatus(); // Use j1-rate-limit snippet to generate this function
      const requestOptions: RequestInit = {
        method,
        headers: this.headers,
      };
      if (body) {
        requestOptions.body = JSON.stringify(body);
      }

      const response: ProviderResponse<T> = (await fetch(
        this.BASE_URL + endpoint,
        requestOptions,
      )) as ProviderResponse<T>;

      if (response.status === 401) {
        throw new IntegrationProviderAuthenticationError({
          endpoint,
          status: response.status,
          statusText: response.statusText,
        });
      } else if (response.status === 403) {
        throw new IntegrationProviderAuthorizationError({
          endpoint,
          status: response.status,
          statusText: response.statusText,
        });
      } else if (!response.ok) {
        throw new IntegrationProviderAPIError({
          endpoint,
          status: response.status,
          statusText: response.statusText,
        });
      } else if (response.status === 200) {
        // Set a new rate limit status after each successful request
        // this.setRateLimitStatus(response); // Use j1-rate-limit snippet to generate this function
      }

      return response;
    };

    return await retry(requestAttempt, {
      // The maximum number of attempts or 0 if there is no limit on number of attempts.
      maxAttempts: 3,
      // The delay between each attempt in milliseconds. You can provide a factor to have the delay grow exponentially.
      delay: 30_000,
      // A timeout in milliseconds. If timeout is non-zero then a timer is set using setTimeout.
      // If the timeout is triggered then future attempts will be aborted.
      timeout: 180_000,
      // The factor option is used to grow the delay exponentially.
      // For example, a value of 2 will cause the delay to double each time
      factor: 2,
      handleError: (error, attemptContext) => {
        if ([401, 403, 404].includes(error.status)) {
          attemptContext.abort();
        }

        if (attemptContext.aborted) {
          this.logger.warn(
            { attemptContext, error, endpoint },
            'Hit an unrecoverable error from API Provider. Aborting.',
          );
        } else {
          this.logger.warn(
            { attemptContext, error, endpoint },
            `Hit a possibly recoverable error from API Provider. Waiting before trying again.`,
          );
        }
      },
    });
  }
  ...
}
```
