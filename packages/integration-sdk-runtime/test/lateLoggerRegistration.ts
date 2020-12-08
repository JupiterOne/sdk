import {
  executeIntegrationInstance,
  registerIntegrationLoggerEventHandlers,
  unregisterIntegrationLoggerEventHandlers,
} from '../src';
import {
  LOCAL_INTEGRATION_INSTANCE,
  createMockIntegrationLogger,
  LOCAL_EXECUTION_HISTORY,
} from './util/fixtures';
import { expect } from './util/expect'

function throwsUnhandledRejection() {
  return () => {
    async function throwsException() {
      await Promise.resolve();
      throw new Error();
    }
    void throwsException();
  };
}

/**
 * This tests for an expected pattern that we will see in the wild, where a calling
 * function will register this function as soon as the node process starts, and
 * will overwrite the `logger` variable a bit later, once the `IntegrationLogger` has
 * been constructed.
 */
export async function executeIntegrationInstanceWithLateRegisteredLogger() {
  // call registerIntegrationLoggerEventHandlers when logger is an early/undesirable version
  let wasPseudoLoggerCalled = false;
  const pseudoLogger = {
    error: () => {
      wasPseudoLoggerCalled = true;
    },
  };registerIntegrationLoggerEventHandlers
  let logger: any = pseudoLogger;
  const registeredEventHandlers = registerIntegrationLoggerEventHandlers(() => logger);

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
  }, LOCAL_EXECUTION_HISTORY);
  unregisterIntegrationLoggerEventHandlers(registeredEventHandlers);
  expect(wasPseudoLoggerCalled).toBe(false);
  expect(wasIntegrationLoggerCalled).toBe(true);
}
