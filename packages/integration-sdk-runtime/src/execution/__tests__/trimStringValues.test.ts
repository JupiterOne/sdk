import { IntegrationInstance } from '@jupiterone/integration-sdk-core';
import { trimStringValues } from '../utils/trimStringValues';

describe('trimStringValues', () => {
  const untrimmedIntegrationInstance: IntegrationInstance = {
    id: ' test ',
    accountId: ' test',
    name: 'test ',
    integrationDefinitionId: '    test',
    description: 'test    ',
    config: {
      test: '   test   ',
      test2: 'test',
    },
  };

  test('trims spaces on all keys', () => {
    const expected = {
      id: 'test',
      accountId: 'test',
      name: 'test',
      integrationDefinitionId: 'test',
      description: 'test',
      config: {
        test: 'test',
        test2: 'test',
      },
    };
    expect(trimStringValues(untrimmedIntegrationInstance)).toEqual(expected);
  });

  test('leaves skipped fields unchanged', () => {
    const expected = {
      id: 'test',
      accountId: untrimmedIntegrationInstance.accountId,
      name: 'test',
      integrationDefinitionId:
        untrimmedIntegrationInstance.integrationDefinitionId,
      description: 'test',
      config: {
        test: untrimmedIntegrationInstance.config.test,
        test2: 'test',
      },
    };
    expect(
      trimStringValues(untrimmedIntegrationInstance, [
        'accountId',
        'integrationDefinitionId',
        'unincludedKey',
        'test',
      ]),
    ).toEqual(expected);
  });
});
