const {
  executeIntegrationInstance,
  registerIntegrationLoggerEventEmitters,
  unregisterIntegrationLoggerEventEmitters,
} = require('../dist/src');
const {
  LOCAL_INTEGRATION_INSTANCE,
  createMockIntegrationLogger,
} = require('./util/fixtures');
const { expect } = require('./util/expect');

function throwsUnhandledRejection() {
  return async () => {
    async function throwsException() {
      await Promise.resolve();
      throw new Error();
    }
    throwsException();
  };
}

/**
 * This tests for an expected pattern that we will see in the wild, where a calling
 * function will register this function as soon as the node process starts, and
 * will overwrite the `logger` variable a bit later, once the `IntegrationLogger` has
 * been constructed.
 */
async function executeIntegrationInstanceWithLateRegisteredLogger() {
  // call registerIntegrationLoggerEventEmitters when logger is an early/undesirable version
  let wasPseudoLoggerCalled = false;
  const pseudoLogger = {
    error: () => {
      wasPseudoLoggerCalled = true;
    },
  };
  let logger = pseudoLogger;
  registerIntegrationLoggerEventEmitters(() => logger);

  // later in execution, reset logger to the desirable version.
  let wasIntegrationLoggerCalled = false;
  const integrationLogger = createMockIntegrationLogger({
    error: () => {
      wasIntegrationLoggerCalled = true;
    },
  });
  logger = integrationLogger;

  await executeIntegrationInstance(logger, LOCAL_INTEGRATION_INSTANCE, {
    integrationSteps: [
      {
        id: '',
        name: '',
        entities: [],
        relationships: [],
        executionHandler: throwsUnhandledRejection(),
      },
    ],
  });
  unregisterIntegrationLoggerEventEmitters(() => logger);
  expect(wasPseudoLoggerCalled).toBe(false);
  expect(wasIntegrationLoggerCalled).toBe(true);
}

module.exports = { executeIntegrationInstanceWithLateRegisteredLogger };
