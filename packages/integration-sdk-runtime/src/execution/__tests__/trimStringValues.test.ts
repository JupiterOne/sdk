import { IntegrationInstance } from '@jupiterone/integration-sdk-core';
import { trimStringValues } from '../utils/trimStringValues';

describe('trimStringValues', () => {
  test('provides generated logger and instance', () => {
    const untrimmedIntegrationInstance: IntegrationInstance = {
      id: ' test ',
      accountId: ' test',
      name: 'test ',
      integrationDefinitionId: '    test',
      description: 'test    ',
      config: {
        test: '   test   ',
      },
    };
    const expected = {
      id: 'test',
      accountId: 'test',
      name: 'test',
      integrationDefinitionId: 'test',
      description: 'test',
      config: {
        test: 'test',
      },
    };
    expect(trimStringValues(untrimmedIntegrationInstance)).toEqual(expected);
  });
});
