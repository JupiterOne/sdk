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

function callbackThrowsUnhandledRejection(err) {
  return async () => {
    async function throwsException() {
      await Promise.resolve();
      throw err;
    }
    throwsException();
  };
}

async function executeIntegrationInstanceWithUnhandledRejection() {
  const err = new Error();
  let logger;
  const loggerErrorCalledWith = [];
  function loggerError(...params) {
    loggerErrorCalledWith.push([...params]);
  }
  logger = createMockIntegrationLogger({ error: loggerError });
  registerIntegrationLoggerEventEmitters(() => logger);
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
  });
  unregisterIntegrationLoggerEventEmitters(() => logger);
  expect(loggerErrorCalledWith.length).toBe(1);
  expect(loggerErrorCalledWith[0][0]).toBe(err);
}

module.exports = { executeIntegrationInstanceWithUnhandledRejection };
