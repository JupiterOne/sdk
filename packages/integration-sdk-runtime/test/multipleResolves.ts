import { LOCAL_EXECUTION_HISTORY } from "./util/fixtures";

import {
  executeIntegrationInstance,
  registerIntegrationLoggerEventEmitters,
  unregisterIntegrationLoggerEventEmitters,
} from '../src';
import {
  LOCAL_INTEGRATION_INSTANCE,
  createMockIntegrationLogger,
} from './util/fixtures'
import { expect } from './util/expect';

function callbackThrowsMultipleResoles(err) {
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
  registerIntegrationLoggerEventEmitters(() => logger);
  await executeIntegrationInstance(logger, LOCAL_INTEGRATION_INSTANCE, {
    integrationSteps: [
      {
        id: '',
        name: '',
        entities: [],
        relationships: [],
        executionHandler: callbackThrowsMultipleResoles(err),
      },
    ],
  }, LOCAL_EXECUTION_HISTORY);
  unregisterIntegrationLoggerEventEmitters(() => logger);
  expect(loggerErrorCalledWith.length).toBe(1);
  expect(loggerErrorCalledWith[0][0].err).toBe(err);
  expect(loggerErrorCalledWith[0][0].event).toBe('multipleResolves');
}
