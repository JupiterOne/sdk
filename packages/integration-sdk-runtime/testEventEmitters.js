require('./test/mocks/mockWriteJsonToPath');

const {
  executeIntegrationInstanceWithUnhandledRejection,
} = require('./test/unhandledRejection');
const {
  executeIntegrationInstanceWithMultipleResolves,
} = require('./test/multipleResolves');
const {
  executeIntegrationInstanceWithLateRegisteredLogger,
} = require('./test/lateLoggerRegistration');

const eventEmitterTests = {
  unhandledRejection: executeIntegrationInstanceWithUnhandledRejection,
  multipleResolves: executeIntegrationInstanceWithMultipleResolves,
  lateRegisteredLogger: executeIntegrationInstanceWithLateRegisteredLogger,
};

void (async () => {
  for (const [eventEmitterName, eventEmitterTest] of Object.entries(
    eventEmitterTests,
  )) {
    console.log(`\nTesting event emitter: ${eventEmitterName}`);
    await eventEmitterTest();
    console.log('Event emitter test passed!');
  }
})();
