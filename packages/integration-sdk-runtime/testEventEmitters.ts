require('./test/mocks/mockWriteJsonToPath');

import { 
  executeIntegrationInstanceWithUnhandledRejection 
} from './test/unhandledRejection';
import {
  executeIntegrationInstanceWithMultipleResolves,
} from './test/multipleResolves';
import {
  executeIntegrationInstanceWithLateRegisteredLogger,
} from './test/lateLoggerRegistration';

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
