import { LOCAL_EXECUTION_HISTORY } from './util/fixtures';

import {
  executeIntegrationInstance,
  registerIntegrationLoggerEventHandlers,
  unregisterIntegrationLoggerEventHandlers,
} from '../src';
import {
  LOCAL_INTEGRATION_INSTANCE,
  createMockIntegrationLogger,
} from './util/fixtures';
import { expect } from './util/expect';

function callbackThrowsMultipleResolves(err) {
  return async () => {
    await Promise.all([
      (async () => {
        await Promise.resolve();
        throw err;
      })(),
      (async () => {
        await Promise.resolve();
        throw err;
      })(),
    ]);
  };
}

export async function executeIntegrationInstanceWithMultipleResolves() {
  const err = new Error();
  const loggerErrorCalledWith: any[] = [];
  function loggerError(...params) {
    loggerErrorCalledWith.push([...params]);
  }
  const logger = createMockIntegrationLogger({ error: loggerError });
  const registeredEventHandlers = registerIntegrationLoggerEventHandlers(
    () => logger,
  );
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
          executionHandler: callbackThrowsMultipleResolves(err),
        },
      ],
    },
    LOCAL_EXECUTION_HISTORY,
  );
  unregisterIntegrationLoggerEventHandlers(registeredEventHandlers);
  expect(loggerErrorCalledWith.length).toBe(1);
  expect(loggerErrorCalledWith[0][0].err).toBe(err);
  expect(loggerErrorCalledWith[0][0].event).toBe('multipleResolves');
}
