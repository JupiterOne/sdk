# Integration testing

To make testing integrations easy, we expose some utilties from
`@jupiterone/integration-sdk/testing` to help with performing common actions.

## Utilities

### Unit testing

#### `createMockExecutionContext`

For simple unit testing of the `getStepStartStates` and the `validateInvocation`
functions, we expose a utility for creating a mock execution context.

This function accepts options to populate the integration instance's `config`
field to help with testing different code paths.

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
