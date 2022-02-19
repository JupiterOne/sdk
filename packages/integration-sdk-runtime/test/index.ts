require('./mocks/mockWriteJsonToPath');

import { executeIntegrationInstanceWithUnhandledRejection } from './unhandledRejection';
import { executeIntegrationInstanceWithMultipleResolves } from './multipleResolves';
import { executeIntegrationInstanceWithLateRegisteredLogger } from './lateLoggerRegistration';
import { executeIntegrationInstanceWithUnregisteredEventHandlers } from './unregisterEventHandlers';

const eventEmitterTests = {
  unhandledRejection: executeIntegrationInstanceWithUnhandledRejection,
  multipleResolves: executeIntegrationInstanceWithMultipleResolves,
  lateRegisteredLogger: executeIntegrationInstanceWithLateRegisteredLogger,
  unregisterEventHandlers:
    executeIntegrationInstanceWithUnregisteredEventHandlers,
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
