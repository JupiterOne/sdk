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
import { expect } from './util/expect';

function throwsUnhandledRejection() {
  async function throwsException() {
    await Promise.resolve();
    throw new Error();
  }
  void throwsException();
}

/**
 * This tests that the unregisterEventHandlers function works as expected
 *
 * The console _will_ print out an `UnhandledPromiseRejectionWarning`, which is expected,
 * since we have unregistered the function that would otherwise handle this error.
 */
export async function executeIntegrationInstanceWithUnregisteredEventHandlers() {
  let wasLoggerErrorCalled = false;
  const logger = createMockIntegrationLogger({
    error: () => {
      wasLoggerErrorCalled = true;
    },
  });
  const registeredEventHandlers = registerIntegrationLoggerEventHandlers(
    () => logger,
  );
  unregisterIntegrationLoggerEventHandlers(registeredEventHandlers);

  await executeIntegrationInstance(
    logger,
    LOCAL_INTEGRATION_INSTANCE,
    {
      integrationSteps: [
        {
          id: '',
          name: '',
          entities: [],
          relationships: [],
          executionHandler: throwsUnhandledRejection,
        },
      ],
    },
    LOCAL_EXECUTION_HISTORY,
  );
  expect(wasLoggerErrorCalled).toBe(false);
}
