# Getting Started with Integration Development

In this Development Guide, we will walk you through the initial steps of getting
your integration up and running. Along the way, we will provide tips and tricks
to ensure your success. JupiterOne has a number of open source projects that
provide an easy-to-use framework for creating a new integration, including the
code found in this SDK project.

## Table of Contents

- [Requirements](#requirements)
- [Getting Started](#getting-started)
  - [Setup](#setup)
  - [Developing the Integration](#developing-the-integration)
    - [Creating instanceConfigFields](#creating-instanceconfigfields)
    - [Creating validateInvocation](#creating-validateinvocation)
    - [Creating your first IntegrationStep](#creating-you-first-integrationstep)
-

## Requirements

You'll need:

- Node.js

  - It's recommended to use a Node version manager. Both
    [fnm](https://github.com/Schniz/fnm) and
    [nvm](https://github.com/nvm-sh/nvm) are great choices.

- yarn
  ```sh
    npm install --global yarn
  ```

## Getting Started

### **Setup**

**Through the GitHub CLI**

```sh
gh repo create graph-$INTEGRATION_NAME --public \
  --clone \
  --template=https://github.com/jupiterone/integration-template
cd graph-$INTEGRATION_NAME
yarn install
```

**Through the GitHub UI**

1. Use the
   [**integration-template**](https://github.com/JupiterOne/integration-template)
   to create a new repository
2. Clone your repository and run `yarn install`

```sh
git clone https://github.com/$USERNAME/$REPO_NAME`
cd $REPO_NAME
yarn install
```

That's it! Your project is ready for development!

### **Developing the Integration**

In this guide, we will create a small integration with
[DigitalOcean](https://digitalocean.com) using examples that can be applied to
the integration you are building.

#### **Integration Configuration**

Every integration builds and exports an `InvocationConfig` that is used to
execute the integration.

[//]: # 'TODO: Add reference or link to document showing integration execution'

In the new integration you created you can see the `InvocationConfig` exported
in
[`src/index.ts`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/index.ts#L9-L14)

**`src/index.ts`**

```ts
export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> =
  {
    instanceConfigFields,
    validateInvocation,
    integrationSteps,
  };
```

Let's work top to bottom. We'll start by defining `instanceConfigFields`, next
we'll implement `validateInvocation`, and finally define our `integrationSteps`.

#### **1. Creating `InstanceConfigFields`**

The first object in our `InvocationConfig` is `instanceConfigFields` with type
[`IntegrationInstanceConfigFieldsMap`](https://github.com/JupiterOne/sdk/blob/1280faf454cefa6aff1aabd90b4890c1920b88c9/packages/integration-sdk-core/src/types/config.ts#L68-L70).
You'll find this defined in your project in
[`src/config.ts`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/config.ts#L9-L31).

**`src/config.ts`**

```ts
/**
 * A type describing the configuration fields required to execute the
 * integration for a specific account in the data provider.
 *
 * When executing the integration in a development environment, these values may
 * be provided in a `.env` file with environment variables. For example:
 *
 * - `CLIENT_ID=123` becomes `instance.config.clientId = '123'`
 * - `CLIENT_SECRET=abc` becomes `instance.config.clientSecret = 'abc'`
 *
 * Environment variables are NOT used when the integration is executing in a
 * managed environment. For example, in JupiterOne, users configure
 * `instance.config` in a UI.
 */
export const instanceConfigFields: IntegrationInstanceConfigFieldMap = {
  clientId: {
    type: 'string',
  },
  clientSecret: {
    type: 'string',
    mask: true,
  },
};
```

This object let's us control how the integration will execute. A common use is
to provide credentials to authenticate requests. For example, DigitalOcean
requires a `Personal Access Token` (see below for example). Other common config
values include a `Client ID`, `API Key`, or `API URL`. Any outside information
the integration needs at runtime can be defined here.

DigitalOcean requires a `Person Access Token`, so I'll edit the fields to show
that.

**`src/config.ts`**

```diff
export const instanceConfigFields: IntegrationInstanceConfigFieldMap = {
-  clientId: {
-    type: 'string',
-  },
-  clientSecret: {
-    type: 'string',
-    mask: true,
-  },
+  accessToken: {
+    type: 'string',
+    mask: true,
+  }
};
```

| :warning: IMPORTANT                                                                             |
| :---------------------------------------------------------------------------------------------- |
| The `mask` property should be set to true anytime a property is secret and shouldn't be logged. |

We should also edit
[`IntegrationConfig`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/config.ts#L37-L47)
in the same file to match `instanceConfigFields`. `IntegrationConfig` is used to
add and provide type information throughout the project.

**`src/config.ts`**

```diff
export interface IntegrationConfig extends IntegrationInstanceConfig {
-  /**
-   * The provider API client ID used to authenticate requests.
-   */
-  clientId: string;
-
-  /**
-   * The provider API client secret used to authenticate requests.
-   */
-  clientSecret: string;
+  /**
+   * The accessToken to use when authenticating with the API.
+   */
+  accessToken: string;
}
```

Lastly, we will want to create an **.env** file with our configuration.

```sh
cp .env.example .env
```

**`.env`**

```diff
- CLIENT_ID=
- CLIENT_SECRET=
+ ACCESS_TOKEN=<access token goes here>
```

| :warning: IMPORTANT                                                                                                                                                       |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The **.env** file should **NEVER** be committed. The **integration-template** has `.env` in the **.gitignore**, but always be sure not to accidentally add and commit it! |

Awesome! We have created our `instanceConfigFields` and `IntegrationConfig`.
Let's go to the next step.

#### **2. Creating `ValidateInvocation`**

Next, we will create a our `validateInvocation` function. The
`validateInvocation` has the following signature:

- TODO: Consider deferring to development.md The next object in our
  `IntegrationConfig` is `validateInvocation`: This is the type signature for
  [`validateInvocation`](https://github.com/JupiterOne/sdk/blob/63630abe43455b4035b311c71d72f8aa9a602ffb/packages/integration-sdk-core/src/types/validation.ts#L4-L6).

```ts
export type InvocationValidationFunction<T extends ExecutionContext> = (
  context: T,
) => Promise<void> | void;
```

The basic contract for `validateInvocation` is as follows:

- The function receives the execution context and configuration we set in
  `instanceConfigFields`.
- The function will validate that all configuration is present and valid or
  throw an error otherwise.

Let's create a `validateInvocation` for DigitalOcean.

**`src/config.ts`**

```diff
export async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>
 ) {
   const { config } = context.instance;

-  if (!config.clientId || !config.clientSecret) {
+  if (!config.accessToken) {
     throw new IntegrationValidationError(
-      'Config requires all of {clientId, clientSecret}',
+      'Config requires accessToken',
     );
   }
-
- const apiClient = createAPIClient(config);
- await apiClient.verifyAuthentication();
+ // const apiClient = createAPIClient(config);
+ // await apiClient.verifyAuthentication();
 }
```

You'll notice at the bottom we commented these two lines.

```ts
- const apiClient = createAPIClient(config);
- await apiClient.verifyAuthentication();
```

It's good practice to test your credentials in `validateInvocation` by making a
light-weight authenticated request to your provider API, but we don't have a
working API Client or a `verifyAuthentication` method to use yet, so let's add
one in.

## Adding or Creating an API Client

There are three common cases when creating your integration's `APIClient`.

1. The provider you are integrating with provides an out-of-the-box open source
   - Examples Integrations:
     [**graph-microsoft-365**](https://github.com/JupiterOne/graph-microsoft-365/blob/main/src/ms-graph/client.ts),
     [**graph-google-cloud**](https://github.com/JupiterOne/graph-google-cloud/blob/main/src/google-cloud/client.ts)
2. An open source client exists and is well maintained, trusted, and widely
   used.
   - Examples Integrations: []
3. There is no provider client and there are no open source clients or the
   clients that exist fail to meet a high standard of trust and use.
   - Examples Integrations:
     [**graph-rumble**](https://github.com/JupiterOne/graph-rumble/blob/main/src/client.ts),
     [**graph-crowdstrike**](https://github.com/JupiterOne/graph-crowdstrike/blob/main/src/crowdstrike/FalconAPIClient.ts),

In the first two cases, it is often better to use a publicly available client if
there aren't extenuating circumstances.

In the third case, we will need to implement the client ourselves as part of the
integration.

For DigitalOcean, there is not a provider supported client and the open source
clients available are not widely used. So let's make our own. The patterns would
be similar in the first or second case, we'll just go one step deeper here.

### Basic Client Setup

We will first want to make sure our client has access to the information it
needs to make authenticated request. If we anticipate logging from our client we
should also add `IntegrationLogger` to the constructor parameters.

**`src/steps/client.ts`**

```diff
export class APIClient {
-  constructor(readonly config: IntegrationConfig) {}
+  private BASE_URL = 'https://api.digitalocean.com/v2';
+  constructor(
+    readonly config: IntegrationConfig,
+    readonly logger: IntegrationLogger
+  ) {}
...
- export function createAPIClient(config: IntegrationConfig): APIClient
+ export function createAPIClient(
+  config: IntegrationConfig,
+  logger: IntegrationLogger
+ ): APIClient {
-    return new APIClient(config);
+    return new APIClient(config, logger);
}
```

### Adding the first route

As discussed earlier, we need a way to test that we can authenticate with the
provider api to use in `validateInvocation`. We will want to make a lightweight
authenticated request. What endpoint you choose will vary from provider to
provider, but for DigitalOcean, we'll use the `/account` endpoint.

Let's create a new `getAccount` method from `APIClient`

We'll first create a type to represent the `DigitalOceanAccount` response
object. Let's go to the
[`src/types.ts`](https://github.com/JupiterOne/integration-template/blob/main/src/types.ts)
file. There are good examples of how we might define our types, but let's delete
them and create our own.

**`src/types.ts`**

```ts
// modeled from the example response from the DigitalOcean API
// See: https://docs.digitalocean.com/reference/api/api-reference/#tag/Account
export interface DigitalOceanAccount {
  account: {
    droplet_limit: number;
    floating_ip_limit: number;
    email: string;
    uuid: string;
    email_verified: boolean;
    status: string;
    status_message: string;
  };
}
```

We'll also need to add an http client to make requests. I'll use `node-fetch`,
but the client you use is up to you.

```sh
yarn add node-fetch
```

Now we can add the `getAccount` method to our client.

```ts
import {
  IntegrationLogger,
  IntegrationProviderAPIError
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
} from '@jupiterone/integration-sdk-core';
import fetch from 'node-fetch';
import { DigitalOceanAccount } from './types';

...
export class APIClient {
...
  public async getAccount(): Promise<DigitalOceanAccount> {
    const endpoint = '/account';
    const response = await fetch(this.BASE_URL + endpoint, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
      },
    });

    // If the response is not ok, we should handle the error
    if (!response.ok) {
      this.handleApiError(response, endpoint);
    }

    return (await response.json()) as DigitalOceanAccount;
  }

   private handleApiError(err: any, endpoint: string): void {
    if (err.status === 401) {
      throw new IntegrationProviderAuthenticationError({
        endpoint: endpoint,
        status: err.status,
        statusText: err.statusText,
      });
    } else if (err.status === 403) {
      throw new IntegrationProviderAuthorizationError({
        endpoint: endpoint,
        status: err.status,
        statusText: err.statusText,
      });
    } else {
      throw new IntegrationProviderAPIError({
        endpoint: endpoint,
        status: err.status,
        statusText: err.statusText,
      });
    }
}
```

In the `getAccount` method, we define the endpoint, make the request, handle any
errors, and return the response.

Now we can add authentication verification to our `validateAuthentication`.

**`src/config.ts`**

```diff
export async function validateInvocation(
  context: IntegrationExecutionContext<IntegrationConfig>
 ) {
   const { config } = context.instance;

  if (!config.accessToken) {
     throw new IntegrationValidationError(
      'Config requires accessToken',
     );
   }
- // const apiClient = createAPIClient(config);
- // await apiClient.verifyAuthentication();
+ const apiClient = createAPIClient(config, context.);
+ await apiClient.getAccount();
 }
```

And that's `validateInvocation` completed! :tada: We can now proceed to our
`IntegrationSteps` knowing that we have a valid configuration to work with.

## Creating you first `IntegrationStep`

Let's get some data! Integrations are executed in Steps. Steps are functions
which can produce **Entities**, **Relationships**, and **MappedRelationships**.
It is good practice to limit each step to create a small number of closely
related resources. If one step fails, other steps may still be able to succeed.

An `IntegrationStep` is made up of two parts - an `ExecutionHandlerFunction`
which does the work of the step and `StepMetadata` which exports information
about the work the `ExecutionHandlerFunction` will do.

We can see and example `Account` step in our project.

**`src/steps/account/index.ts`**

```ts
export const accountSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.ACCOUNT,
    name: 'Fetch Account Details',
    entities: [Entities.ACCOUNT],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchAccountDetails,
  },
];
```

Let's go through the properties of the step:

- `id` is the _unique_ identifier for the step.
- `name` is the human readable name of the step that will appear in logs.
- `entities` is the set of entities the step will produce
- `relationships` is the set of relationships the step will produce
- `dependsOn` is the steps, referenced by their `id`, which the current step
  depends on. This step doesn't need information from other steps so there are
  no dependencies.
- `executionHandler` is the function that will perform the work for the step.

This step has an `id`, which _uniquely_ identifies the step, given by a constant
`Steps.ACCOUNT`. The step has a name, `Fetch Account Details`, which will show
up in human readable logs. It also declares that the `executionHandler`,
`fetchAccountDetails`, will create an `ACCOUNT` entity.

Let's see what the `ACCOUNT` entity looks like:

**`src/steps/constants.ts`**

```ts
ACCOUNT: {
    resourceName: 'Account',
    _type: 'acme_account',
    _class: ['Account'],
    schema: {
      properties: {
        mfaEnabled: { type: 'boolean' },
        manager: { type: 'string' },
      },
      required: ['mfaEnabled', 'manager'],
    },
  },
```

This object provides a few different properties:

- `resourceName`: The natural resource name in the integration provider. For
  example: `S3 Bucket`.
- `_type`: An identifier noting the provider and type of resource. For example:
  `aws_ec`2
- `_class`: A class from the JupiterOne
  **[data-model](https://github.com/JupiterOne/data-model/tree/main/src/schemas)**.
  This is used to help classify objects and promote common properties and names
  across different integrations. An example `_class` is
  [`Account`](https://github.com/JupiterOne/data-model/blob/main/src/schemas/Account.json).
  Objects may have more than one `_class`.
- `schema`: An object used to specify and extend the schema inherited from the
  `_class`. This object is useful for testing integrations and showing what
  information can or will show up on the created `Entity` or `Relationship`.

Let's edit this object to conform to our `Account` on DigitalOcean.

```diff
ACCOUNT: {
    resourceName: 'Account',
-    _type: 'acme_account',
+    _type: 'digital_ocean_account',

    _class: ['Account'],
    schema: {
      properties: {
-        mfaEnabled: { type: 'boolean' },
-        manager: { type: 'string' },
+        email: { type: 'string' },
+        email_verified: { type: 'boolean' }
+        status: { type: 'string' }
+        status_message: { type: 'string' }
      },
      required: ['mfaEnabled', 'manager'],
    },
  },
`


```

```ts
interface StepMetadata {
  id: string;
  name: string;
  entities: StepEntityMetadata[];
  relationships: StepRelationshipMetadata[];
  mappedRelationships: StepMappedRelationshipMetadata[];
  dependsOn?: string[];
  dependencyGraphId?: string;
}
```

We can see an implementation in
[`src/steps/account/index.ts`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/steps/account/index.ts#L20-L29).

Let's work on getting our DigitalOcean Account ingested.

In `src/types.ts` we'll setup the basic type for our `DigitalOceanAccount`.

```diff
- export interface AcmeAccount {
-  id: string;
-  name: string;
+ export interface DigitalOceanAccount {
+  uuid: string;
+  email: string;
+  email_verified: boolean;
+  status: string;
+  status_message: string;
}
```

Let's also make a change in `src/constants.ts` so our step knows information
about the entity we are ingesting.

```diff



export const Entities: Record<'ACCOUNT', StepEntityMetadata> = {
  ACCOUNT: {
    resourceName: 'Account',
-   _type: 'acme_account',
+   _type: 'digital_ocean_account',
    _class: ['Account'],
    schema: {
      properties: {},
      required: [],
    },
  },
};
```

We'll also need to use a http client to make requests to our provider. Here
we'll use the `integration-sdk-http-client`.

```sh
yarn add @jupiterone/integration-sdk-http-client
```

Edits to the `src/client.ts`

# TODO: This is more edits than I really want :/

```diff
 import { IntegrationConfig } from './config';
-import { AcmeAccount } from './types';
+import { DigitalOceanAccount } from './types';
+
+import { APIClient as sdkApiClient } from '@jupiterone/integration-sdk-http-client';
+import {
+  APIRequest,
+  APIResponse,
+} from '@jupiterone/integration-sdk-http-client/dist/src/types';

 export type ResourceIteratee<T> = (each: T) => Promise<void> | void;

@@ -12,22 +18,33 @@ export type ResourceIteratee<T> = (each: T) => Promise<void> | void;
  * resources.
  */
 export class APIClient {
-  constructor(readonly config: IntegrationConfig) {}
+  private client: sdkApiClient;
+
+  private BASE_URL = 'https://api.digitalocean.com/v2';
+
+  constructor(readonly config: IntegrationConfig) {
+    this.client = new sdkApiClient();
+  }

   /**
    * getAccount fetches the account details from the provider API.
    * @returns {Promise<AcmeAccount>} A promise for the AcmeAccount
    */
-  public async getAccount(): Promise<AcmeAccount> {
-    // This is where an authenticated request to the provider API would be made
-    // We return a promise that resolves to mock data
-    // to simulate an API response
-    return new Promise<AcmeAccount>((resolve) => {
-      resolve({
-        id: 'account-id',
-        name: 'Account Name',
-      });
-    });
+  public async getAccount(): Promise<DigitalOceanAccount> {
+    const request: APIRequest = {
+      url: this.BASE_URL + '/account',
+      headers: {
+        Authorization: `Bearer ${this.config.accessToken}`,
+      },
+      method: 'GET',
+    };
+    const response = await this.client.executeAPIRequest(request);
+    return response.data as DigitalOceanAccount;
+
   }
 }
```

# TODO: Trim/move this section once the examples become more clear

Let's go through these one by one:

- `id` is the _unique_ identifier for the step
- `name` is the public facing name of the step. You'll see this name appear in
  logs.
- `entities` describes which entities the step may produce.
- `relationships`, like `entities`, describes which relationships may be
  produced in our step
- `dependsOn` describes what other steps this step depends on. TODO :MAKE BETTER
- `executionHandler` is the function called to execute this step. It's where the
  work happens!

```ts
export async function fetchAccountDetails({
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const accountEntity = await jobState.addEntity(createAccountEntity());

  await jobState.setData(ACCOUNT_ENTITY_KEY, accountEntity);
}
```

### Editing our client

````ts
const BASE_URI='https://api.digitalocean.com/v2/domain';


export class APIClient {
  constructor(readonly config: IntegrationConfig) {}

  public async getAccount(): Promise<Account> {



  }
}




## Testing

### Writing tests

### Running tests

To run test files in an integration

```sh
yarn test
````

```sh
yarn test:env
```

## Running the integration

### Integration Development Best Practices
