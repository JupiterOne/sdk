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

function callbackThrowsMultipleResoles(err) {
  return async () => {
    await Promise.all([
      (async () => {
        throw err;
      })(),
      (async () => {
        throw err;
      })(),
    ]);
  };
}

async function executeIntegrationInstanceWithMultipleResolves() {
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
        executionHandler: callbackThrowsMultipleResoles(err),
      },
    ],
  });
  unregisterIntegrationLoggerEventEmitters(() => logger);
  expect(loggerErrorCalledWith.length).toBe(1);
  expect(loggerErrorCalledWith[0][0].err).toBe(err);
  expect(loggerErrorCalledWith[0][0].event).toBe('multipleResolves');
}

module.exports = { executeIntegrationInstanceWithMultipleResolves };
