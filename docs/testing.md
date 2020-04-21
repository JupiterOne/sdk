# Integration testing

To make testing integrations easy, we expose some utilties from
`@jupiterone/integration-sdk/testing` to help with performing common actions.

## Utilities

### Unit testing

#### `createMockExecutionContext`

For simple unit testing of the `getStepStartStates` and the `validateInvocation`
functions, we expose a utility for creating a mock execution context.

This function accepts options to populate the integration instance's `config`
field to help with testing different code paths via the `instanceConfig` option.
If the `instanceConfig` option is not set, the SDK will read the
`src/instanceConfigFields.json` and load in values from environment variables
and the project's `.env` file if present.

If unable to create load a config from environment variables, the function will
create a configuration with mock values based the types specified in
`src/instanceConfigFields.json`.

Example `instanceConfigFields.json` file:

```json
{
  "apiKey": {
    "type": "string"
  }
}
```

Usage:

```typescript
// creates a simple execution context with a mocked
// logger and an instance with mocked values
const contextWithGeneratedConfig = createMockExecutionContext();
/**
 * Returns:
 *
 * {
 *   logger: <mockLogger>,
 *   instance: {...<local integration instance>, config: { apiKey: 'STRING_VALUE' } }
 * }
 */

// constructs instance config using environment variables
process.env.API_KEY = 'my-api-key';
const contextWithConfigBuiltFromEnv = createMockExecutionContext();
/**
 * Returns:
 *
 * {
 *   logger: <mockLogger>,
 *   instance: {...<local integration instance>, config: { apiKey: 'my-api-key' } }
 * }
 */

// creates an execution context with a mocked
// logger and instance populated with the input config
const contextWithProvidedInstanceConfig = createMockExecutionContext({
  instanceConfig: {
    apiKey: 'test',
  },
});
/**
 * Returns:
 *
 * {
 *   logger: <mock integration logger>,
 *   instance: {...<local integration instance>, config: { apiKey: 'test' } }
 * }
 */
```

Example usage in a test:

```typescript
import { createMockExecutionContext } from '@jupiterone/integration-sdk/testing';
import getStepStartStates from './getStepStartStates';

test('disables "fetch-accounts" step if "skipAccounts" is set to true on the instance config', () => {
  const context = createMockExecutionContext({
    instanceConfig: {
      apiKey: 'test',
      skipAccounts: true,
    },
  });

  const stepStartStates = getStepStartStates(context);

  expect(getStepStartStates).toEqual({
    'fetch-accounts': {
      disabled: true,
    },
    'other-step': {
      disabled: false,
    },
  });
});
```

#### `createMockStepExecutionContext`

To assist with unit testing steps, we expose a utility for creating a mocked
version of the step execution context.

This version of the context object stores the entities and relationships
collected via the `jobState` in memory.

For convenience, the `jobState` created by the mocked context exposes a slightly
different interface than the regular `jobState` object and allows for data
collected via the `addEntities` and `addRelationships` functions to be accessed
via `collectedEntities` and `collectedRelationships` properties.

Example usage in a test:

```typescript
import step from './my-step';
import { createMockStepExecutionContext } from '@jupiterone/integration-sdk/testing';

test('should generate the expected entities and relationships', () => {
  const entities = [expectedEntityA];
  const relationships = [expectedRelationshipA, expectedRelationshipB];
  const context = createMockStepExecutionContext();

  await step.executionHandler(context);

  expect(context.jobState.collectedEntities).toEqual(entities);
  expect(context.jobState.collectedRelationships).toEqual(relationships);
});
```

This function accepts the same options as `createMockExecutionContext` but also
allows passing `entities` and `relationships`. This is helpful for setting up
tests for steps that rely on data from another step. The `entities` and
`relationships` passed in via the options are _not_ included in the
`collectedEntities` and `collectedRelationships` arrays.

Input data is omitted from the `collected*` properties because step tests should
only have to focus on asserting the generation of new data from based on the
previous set of data.

For example:

```typescript
import step from './my-step';
import { createMockStepExecutionContext } from '@jupiterone/integration-sdk/testing';

test('should generate the expected entities and relationships', () => {
  const previousStepEntities = [entityA];
  const previousStepRelationships = [relationshipA, relationshipB];

  const expectedGeneratedEntities = [expectedEntityA];
  const expectedGeneratedRelationships = [expectedRelationshipA];

  const context = createMockStepExecutionContext({
    entities: previousStepEntities,
    relationships: previousStepRelationships,
  });

  await step.executionHandler(context);

  expect(context.jobState.collectedEntities).toEqual(expectedGeneratedEntities);
  expect(context.jobState.collectedRelationships).toEqual(
    expectedGeneratedRelationships,
  );
});
```

#### `setupRecording`

We highly recommend using [Polly.js](https://netflix.github.io/pollyjs/#/) to
record real responses from a provider for use in tests.

To make using Polly.js easier, we expose a `setupRecording` function that
handles most of the setup for you.

The function accepts a `directory` parameter that will be used to determine
where to place a `__recordings__` directory on disk to house recorded data. A
`name` parameter must be provided and will be used as part of the directory name
for the recordings.

You can optionally provide `redactedRequestHeaders` and
`redactedResponseHeaders` options for redacting headers prior to writing the
data to disk.

For full control over all aspects of an entry's request and response, you can
provide a `mutateEntry` function to make tweaks. This can be helpful for
situations where sensitive data is stored in the response or request's body and
needs to be hidden.

Example usage in test:

```typescript
import step from './my-step';
import provider from './myProvider';
import { Recording, setupRecording } from '@jupiterone/integration-sdk/testing';

let recording: Recording;

afterEach(async () => {
  await recording.stop();
});

test('should generate the expected entities and relationships', () => {
  recording = setupRecording({
    name: 'my awesome recording',
    directory: __dirname,
    redactedRequestHeaders: ['api-secret-key'],
  });

  const resources = [];
  await provider.iterateThings((e) => {
    resources.push(e);
  });

  expect(resources).toEqual([
    {
      id: expect.any(String),
      name: 'development',
      tags: expect.objectContaining({
        someTag: 'value',
      }),
    },
  ]);
});
```
