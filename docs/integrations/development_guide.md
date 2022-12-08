# Getting Started with Integration Development

In this Development Guide, we will walk you through the initial steps of getting
your integration up and running. Along the way, we will provide tips and tricks
to ensure your success. JupiterOne has many open-source projects that provide an
easy-to-use framework for creating a new integration, including the code found
in this SDK project.

## Table of Contents

- [Getting Started with Integration Development](#getting-started-with-integration-development)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
    - [**Requirements**](#requirements)
    - [**Setup**](#setup)
  - [**Developing the integration**](#developing-the-integration)
    - [**Integration configuration**](#integration-configuration)
    - [**1. Creating `InstanceConfigFields`**](#1-creating-instanceconfigfields)
    - [**2. Creating `ValidateInvocation`**](#2-creating-validateinvocation)
    - [Adding or Creating an API Client](#adding-or-creating-an-api-client)
    - [Basic Client Setup](#basic-client-setup)
    - [Adding the first route](#adding-the-first-route)
    - [**3. Creating your first `IntegrationStep`**](#3-creating-your-first-integrationstep)
      - [**Creating the `Account` Step**](#creating-the-account-step)
      - [**id**](#id)
      - [**name**](#name)
      - [**entities**](#entities)
    - [**executionHandler**](#executionhandler)
      - [**Converters**](#converters)
  - [Running the integration](#running-the-integration)

## Getting Started

### **Requirements**

You'll need:

- Node.js

  - It's recommended to use a Node version manager. Both
    [fnm](https://github.com/Schniz/fnm) and
    [nvm](https://github.com/nvm-sh/nvm) are great choices.

- yarn
  ```sh
    npm install --global yarn
  ```

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

## **Developing the integration**

In this guide, we will create a small integration with
[DigitalOcean](https://digitalocean.com) using examples which you can apply to
the integration you are building.

### **Integration configuration**

Every integration builds and exports an `InvocationConfig` that is used to
execute the integration.

[//]: # 'TODO: Add reference or link to document showing integration execution'

In the new integration that you created, you can see the `InvocationConfig`
exported in
[`src/index.ts`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/index.ts#L9-L14)

📁 **`src/index.ts`**

```ts
export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> =
  {
    instanceConfigFields,
    validateInvocation,
    integrationSteps,
  };
```

Let's work from the top to bottom. We'll start by defining
`instanceConfigFields`, next we'll implement `validateInvocation`, and finally
define our `integrationSteps`.

### **1. Creating `InstanceConfigFields`**

The first object in our `InvocationConfig` is `instanceConfigFields` with type
[`IntegrationInstanceConfigFieldsMap`](https://github.com/JupiterOne/sdk/blob/1280faf454cefa6aff1aabd90b4890c1920b88c9/packages/integration-sdk-core/src/types/config.ts#L68-L70).
You'll find this defined in your project in
[`src/config.ts`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/config.ts#L9-L31).

📁 **`src/config.ts`**

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

The `instanceConfigFields` object lets us control how the integration will
execute. A common use is to provide credentials to authenticate requests. For
example, DigitalOcean requires a `Personal Access Token` (see below). Other
common config values include a `Client ID`, `API Key`, or `API URL`. Any outside
information the integration needs at runtime can be defined here.

DigitalOcean requires a `Person Access Token`, so I'll edit the fields to show
that.

📁 **`src/config.ts`**

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

| :warning: IMPORTANT                                                                   |
| :------------------------------------------------------------------------------------ |
| The `mask` property should be set to true any time a property is secret or sensitive. |

We should also edit
[`IntegrationConfig`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/config.ts#L37-L47)
in the same file to match `instanceConfigFields`. `IntegrationConfig` is used to
add and provide type information throughout the project.

📁 **`src/config.ts`**

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

Lastly, we will want to create a **.env** file with our configuration. Let's
edit `.env.example` to match our project:

📁 **`.env.example`**

```diff
- CLIENT_ID=
- CLIENT_SECRET=
+ ACCESS_TOKEN=<access token goes here>
```

```sh
cp .env.example .env
```

In the **.env** file, we can put our `ACCESS_TOKEN`. Make sure not to put real
secrets in the **.env.example**!

| :warning: IMPORTANT |
| :------------------ |

| The **.env** file should **NEVER** be committed. The **integration-template**
has `.env` in the **.gitignore**, but always be sure not to add and commit it.

Awesome! We have created our `instanceConfigFields` and `IntegrationConfig`.
Let's go to the next step.

### **2. Creating `ValidateInvocation`**

Next, we will create our `validateInvocation` function. The basic contract for
`validateInvocation` is as follows:

- The function receives the execution context and configuration we set in
  `instanceConfigFields`.
- The function will validate that all configuration is present and valid or
  throw an error otherwise.

Let's create a `validateInvocation` for DigitalOcean.

📁 **`src/config.ts`**

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

You'll notice we commented these two lines:

```ts
const apiClient = createAPIClient(config);
await apiClient.verifyAuthentication();
```

It's good practice to test your credentials in `validateInvocation` by making a
light-weight authenticated request to your provider API, but we don't have a
working API Client or a `verifyAuthentication` method to use yet, so let's add
one.

### Adding or Creating an API Client

There are three common cases when creating your integration's `APIClient`.

1. The provider you are integrating with provides an out-of-the-box open source
   - Examples Integrations:
     [**graph-microsoft-365**](https://github.com/JupiterOne/graph-microsoft-365/blob/main/src/ms-graph/client.ts),
     [**graph-google-cloud**](https://github.com/JupiterOne/graph-google-cloud/blob/main/src/google-cloud/client.ts)
2. An open-source client exists and is well maintained, trusted, and widely
   used.
3. There is no provider client, and there are no open-source clients or the
   clients that exist fail to meet a high standard of trust and use.
   - Examples Integrations:
     [**graph-rumble**](https://github.com/JupiterOne/graph-rumble/blob/main/src/client.ts),
     [**graph-crowdstrike**](https://github.com/JupiterOne/graph-crowdstrike/blob/main/src/crowdstrike/FalconAPIClient.ts),

In the first two cases, it is often better to use a publicly available client if
there aren't extenuating circumstances.

In the third case, we will need to implement the client ourselves as part of the
integration.

For DigitalOcean, there is not a provider-supported client and the open-source
clients available are not widely used. So let's make our own. The patterns would
be similar in the first or second case. We will just go one step deeper here.

### Basic Client Setup

We will first want to ensure our client has access to the information it needs
to make authenticated requests. If we anticipate logging from our client, then
we should add `IntegrationLogger` to the constructor parameters.

📁 **`src/client.ts`**

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
provider API to use in `validateInvocation`. We will want to make a light-weight
authenticated request. What endpoint you choose will vary from provider to
provider, but for DigitalOcean, we'll use the `/account` endpoint.

Let's create a new `getAccount` method from `APIClient`

We'll first create a type to represent the `DigitalOceanAccount` response
object. Let's go to the
[`src/types.ts`](https://github.com/JupiterOne/integration-template/blob/main/src/types.ts)
file. There are good examples of how we might define our types, but let's delete
them and create our own. This interface will be used to represent the data
returned via the API. We should carefully consider what values may not always be
present through testing and reading the API documentation.

📁 **`src/types.ts`**

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

We'll also need to add an HTTP client to make requests. I'll use `node-fetch`,
but the choice of client is up to you.

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
        Authorization: `Bearer ${this.config.accessToken}`,
      },
    });

    // If the response is not ok, we should handle the error
    if (!response.ok) {
      this.handleApiError(response, this.BASE_URL + endpoint);
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

In the `getAccount` method, we define the endpoint, make the request, and handle
any errors. If the request was successful, then we return the response.

Now we can add authentication verification to our `validateAuthentication`.

📁 **`src/config.ts`**

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
+ const apiClient = createAPIClient(config, context.logger);
+ await apiClient.getAccount();
 }
```

And that's `validateInvocation` completed! :tada: We can now proceed to our
`IntegrationSteps` knowing that we have a valid configuration.

### **3. Creating your first `IntegrationStep`**

Let's get some data! Integrations are executed in Steps. Steps are functions
which can produce **Entities**, **Relationships**, and **MappedRelationships**.
It is good practice to limit each step to create a small number of closely
related resources. If one step fails, other steps may still be able to succeed.

The `integrationSteps` are exported from `src/steps/index.ts`.

📁 **`src/steps/index.ts`**

```ts
import { accountSteps } from './account';
import { accessSteps } from './access';

const integrationSteps = [...accountSteps, ...accessSteps];

export { integrationSteps };
```

Let's remove `accessSteps` and focus on `accountSteps`.

```diff
- import { accessSteps } from './access';

- const integrationSteps = [...accountSteps, ...accessSteps];
+ const integrationSteps = [...accountSteps];
```

#### **Creating the `Account` Step**

An `IntegrationStep` is made up of two parts - an `ExecutionHandlerFunction`
which does the work of the step, and `StepMetadata` which exports information
about the work that the `ExecutionHandlerFunction` will do.

Let's look at the example `Account` step.

📁 **`src/steps/account/index.ts`**

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

Let's go through each of these to build our `IntegrationStep`. We'll skip over
`relationships` and `dependsOn` as those will not be used by our step and will
be covered later as advanced topics.

#### **id**

The step `id` is the _unique_ identifier for the step.

It's a good idea to define your step `ids` as constants in
[`src/steps/constants.ts`](https://github.com/JupiterOne/integration-template/blob/057d8b60dd1e47dcdc4010da973578f28ef99522/src/steps/constants.ts#L7-L12)
as you'll want to reference these `ids` in other parts of the project.

```ts
export const Steps = {
  ACCOUNT: 'fetch-account',
  USERS: 'fetch-users',
  GROUPS: 'fetch-groups',
  GROUP_USER_RELATIONSHIPS: 'build-user-group-relationships',
};
```

We already have an account identifier, so we will leave this as-is for now.

#### **name**

The step `name` is the human-readable name of the step that will appear in logs.

#### **entities**

The `entities` property of the step provides metadata about the entities that
are produced by the step.

Let's see what the `ACCOUNT` entity looks like:

📁 **`src/steps/constants.ts`**

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

The `ACCOUNT` object of type `StepEntityMetadata` is used at runtime to define
the structure of the data the integration will produce and test that the
structure is actually produced.

| Property     | Purpose                                                                                                                                                                                                                                                                     | Examples                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| resourceName | The natural resource name in the integration provider.                                                                                                                                                                                                                      | `S3 Bucket`, `Account`, `Organization`                                                                                            |
| \_type       | An identifier noting the provider and type of resource. The `_type` is used to identify and find entities produced by the integration                                                                                                                                       | `aws_ec2`, `tenable_finding`, `github_repo`                                                                                       |
| \_class      | An entity classification from the JupiterOne [data-model](https://github.com/JupiterOne/data-model/tree/main/src/schemas). The `\_class is used to classify objects and promote common properties across different integrations. An entity may have more than one `\_class` | `Account`, `Organization`, `Finding`, `Vulnerability`                                                                             |
| schema       | An object used to specify and extend the schema inherited from the `_class`. This object is useful for testing integrations and providing information about what properties can or will exist on the created `Entity` or `Relationship`                                     | See [`src/steps/constants.ts`](https://github.com/JupiterOne/integration-template/blob/main/src/steps/constants.ts) for examples. |

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
+        emailVerified: { type: 'boolean' }
+        status: { type: 'string' }
+        statusMessage: { type: 'string' }
      },
-     required: ['mfaEnabled', 'manager'],
+     required: ['email', 'emailVerified', 'status']
    },
  },
```

| Tip :bulb:                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| It can be helpful to put properties that will _always_ exist in the required field. Explicitly adding required properties helps communicate what properties to expect to future maintainers. It will also help to test the created entities |

### **executionHandler**

The `executionHandler` is where the work for the step happens. The
executionHandler is a function that takes in the
`IntegrationStepExecutionContext` as a parameter and performs the necessary work
to create entities and relationships.

We can see an example `executionHandler` for the `fetch-account` step.

📁 **`src/steps/account/index.ts`**

```ts
export async function fetchAccountDetails({
  jobState,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const accountEntity = await jobState.addEntity(createAccountEntity());

  await jobState.setData(ACCOUNT_ENTITY_KEY, accountEntity);
}
```

Let's make a few changes to adapt it to work for DigitalOcean.

```diff
export async function fetchAccountDetails({
+ instance,
  jobState,
+ logger
}: IntegrationStepExecutionContext<IntegrationConfig>) {
-   const accountEntity = await jobState.addEntity(createAccountEntity());
-   await jobState.setData(ACCOUNT_ENTITY_KEY, accountEntity);
+   const client = createAPIClient(instance.config, logger);
+   const account = await client.getAccount();
}
```

The last thing we need to do is add our entity to the jobState. To do this,
we'll first want to convert the entity to a common format.

#### **Converters**

Different providers will present data in many different ways. We want to
normalize our data to be more consistent, so we can gather useful insights from
it. The converter will create the normalized entity or relationship from the raw
data the provider gives in an API response.

Let's create our first converter. We can go to `src/steps/accounts/converter.ts`
and remove the example there to start fresh.

📁 **`src/steps/account/converter.ts`**

```ts
import {
  createIntegrationEntity,
  Entity,
} from '@jupiterone/integration-sdk-core';
import { DigitalOceanAccount } from '../../types';

import { Entities } from '../constants';

export function createAccountEntity(account: DigitalOceanAccount): Entity {
  return createIntegrationEntity({
    entityData: {
      source: account,
      assign: {
        _key: account.account.uuid,
        _type: Entities.ACCOUNT._type,
        _class: Entities.ACCOUNT._class,
        name: 'Account',
        dropletLimit: account.account.droplet_limit,
        floatingIpLimit: account.account.floating_ip_limit,
        uuid: account.account.uuid,
        email: account.account.email,
        emailVerified: account.account.email_verified,
        status: account.account.status,
        statusMessage: account.account.status_message,
      },
    },
  });
}
```

There are two parts to the `createIntegrationEntity` function. The `source`
property captures the raw data from the provider.

The `assign` object creates the normalized, searchable data for the entity. We
camel case the `assign` properties. There are four required properties on the
`assign` object. The `_type` and `_class` are required for the reasons stated
discussed above. The `_key` is the unique identifier of the entity. Lastly, the
`name` is the name of the entity. Sometimes an entity will have a natural name
like "Zane's PC", but since the provider doesn't have a good name for the
account, we'll just name it "Account".

Let's finish our `executionHandler` by adding the converter.

```diff
+ import { createAccountEntity } from './converter';
...
export async function fetchAccountDetails({
+ instance,
  jobState,
+ logger
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  const client = createApiClient(instance.config, logger);
  const account = client.getAccount();
+
+ const accountEntity = createAccountEntity(account);
+ await jobState.addEntity(accountEntity);
}
```

And that's it! We have a working `executionHandler`.

## Running the integration

We've now:

- ✅ Created a new integration project
- ✅ Installed dependencies with `yarn install`
- ✅ Created our `instanceConfigFields`
- ✅ Setup a `.env` file
- ✅ Created our `validateInvocation`
- ✅ Added our API Client and authenticated request
- ✅ Created our first `IntegrationStep`

We are now ready to run our integration! We can collect data using:

```sh
yarn start
```

You can see the collected data in the `.j1-integration` and you can visualize
the results with `yarn graph`.

[//]: # 'TODO add references to other more advanced docs'
