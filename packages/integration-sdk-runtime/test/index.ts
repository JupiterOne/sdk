require('./mocks/mockWriteJsonToPath');

import { 
  executeIntegrationInstanceWithUnhandledRejection 
} from './unhandledRejection';
import {
  executeIntegrationInstanceWithMultipleResolves,
} from './multipleResolves';
import {
  executeIntegrationInstanceWithLateRegisteredLogger,
} from './lateLoggerRegistration';
import {
  executeIntegrationInstanceWithUnregisteredEventEmitter,
} from './unregisterEventEmitters';

const eventEmitterTests = {
  unhandledRejection: executeIntegrationInstanceWithUnhandledRejection,
  multipleResolves: executeIntegrationInstanceWithMultipleResolves,
  lateRegisteredLogger: executeIntegrationInstanceWithLateRegisteredLogger,
  unregisterEventEmitters: executeIntegrationInstanceWithUnregisteredEventEmitter,
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
