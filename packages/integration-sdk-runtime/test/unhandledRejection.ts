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
import {
  expect
} from './util/expect';

function callbackThrowsUnhandledRejection(err) {
  return () => {
    async function throwsException() {
      await Promise.resolve();
      throw err;
    }
    void throwsException();
  };
}

export async function executeIntegrationInstanceWithUnhandledRejection() {
  const err = new Error();
  const loggerErrorCalledWith: any[] = [];
  function loggerError(...params) {
    loggerErrorCalledWith.push([...params]);
  }
  const logger = createMockIntegrationLogger({ error: loggerError });
  const registeredEventHandlers = registerIntegrationLoggerEventHandlers(() => logger);
  await executeIntegrationInstance(logger, LOCAL_INTEGRATION_INSTANCE, {
    integrationSteps: [
      {
        id: '',
        name: '',
        entities: [],
        relationships: [],
        executionHandler: callbackThrowsUnhandledRejection(err),
      },
    ],
  }, LOCAL_EXECUTION_HISTORY);
  unregisterIntegrationLoggerEventHandlers(registeredEventHandlers);
  expect(loggerErrorCalledWith.length).toBe(1);
  expect(loggerErrorCalledWith[0][0].err).toBe(err);
  expect(loggerErrorCalledWith[0][0].event).toBe('unhandledRejection');
}
