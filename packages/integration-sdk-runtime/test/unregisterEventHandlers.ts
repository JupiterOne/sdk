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

function createMockExecutionHandler(unhandledRejectionError: Error) {
  return () => {
    async function throwsException() {
      await Promise.resolve();
      throw unhandledRejectionError;
    }

    void throwsException();
  };
}

/**
 * This tests that the unregisterEventHandlers function works as expected
 *
 * The console _will_ print out an `UnhandledPromiseRejectionWarning`, which is expected,
 * since we have unregistered the function that would otherwise handle this error.
 */
export async function executeIntegrationInstanceWithUnregisteredEventHandlers() {
  let wasLoggerErrorCalled = false;

  const unhandledRejectionError = new Error(
    'expected unhandled rejection error',
  );

  const logger = createMockIntegrationLogger({
    error: () => {
      wasLoggerErrorCalled = true;
    },
  });

  const registeredEventHandlers = registerIntegrationLoggerEventHandlers(
    () => logger,
  );

  unregisterIntegrationLoggerEventHandlers(registeredEventHandlers);

  let unhandledRejectionErrorFromProcessEvent: Error | undefined;

  // After Node 15, the behavior of unhandled rejections changed. When no
  // listener is attached, the entire process will exit on an unhandled promise
  // rejection.
  //
  // Register this to prevent the Node.js process from exiting.
  process.on('unhandledRejection', (err: Error) => {
    unhandledRejectionErrorFromProcessEvent = err;
  });

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
          executionHandler: createMockExecutionHandler(unhandledRejectionError),
        },
      ],
    },
    LOCAL_EXECUTION_HISTORY,
  );

  expect(wasLoggerErrorCalled).toBe(false);
  expect(unhandledRejectionErrorFromProcessEvent).toBe(unhandledRejectionError);
}
