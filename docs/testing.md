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

Usage:

```typescript
// creates a simple execution context with a mocked
// logger and instance without a configuration
const simpleContext = createMockExecutionContext();
/**
 * Returns:
 *
 * {
 *   logger: <mockLogger>,
 *   instance: <local integration instance>
 * }
 */

// creates an execution context with a mocked
// logger and instance populated with the input config
const contextWithInstanceConfig = createMockExecutionContext({
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
