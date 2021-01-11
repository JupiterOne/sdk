import { getMaskedFields } from '../utils/getMaskedFields';
import { createInstanceConfiguration } from './utils/createIntegrationConfig';

test('getMaskedFields', () => {
  const invocationConfig = {
    integrationSteps: [],
    instanceConfigFields: {
      a: {
        mask: true,
      },
      b: {
        mask: false,
      },
      c: {},
      d: {
        mask: true,
      },
    },
  };
  const testConfig = createInstanceConfiguration({ invocationConfig })
    .invocationConfig;
  expect(getMaskedFields(testConfig)).toEqual(['a', 'd']);
});
