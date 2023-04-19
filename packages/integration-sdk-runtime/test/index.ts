require('./mocks/mockWriteJsonToPath');

import { executeIntegrationInstanceWithMultipleResolves } from './multipleResolves';

const eventEmitterTests = {
  multipleResolves: executeIntegrationInstanceWithMultipleResolves,
};

/* eslint-disable no-console */
void (async () => {
  for (const [eventEmitterName, eventEmitterTest] of Object.entries(
    eventEmitterTests,
  )) {
    console.log(`\nTesting event emitter: ${eventEmitterName}`);
    await eventEmitterTest();
    console.log('Event emitter test passed!');
  }
})();
