import { mocked } from 'ts-jest/utils';
import globby from 'globby';

import { retrieveIntegrationData } from '../retrieveIntegrationData';
import { IntegrationMissingCollectJSON } from '../error';
import { readJsonFile } from '../../../fileSystem';
import { IntegrationData } from '../types/IntegrationData';
import { createIntegrationRelationship } from '../../data';

jest.mock('globby');
jest.mock('../../../fileSystem');

const mockedGlobby = mocked(globby);
const mockedReadJson = mocked(readJsonFile);

const integrationPath = '/j1-integration';
const integrationData: IntegrationData = {
  entities: [
    { id: '1', _class: 'entity', _key: 'entity:1', _type: 'entity' },
    { id: '2', _class: 'entity', _key: 'entity:2', _type: 'entity' },
  ],
  relationships: [
    createIntegrationRelationship({
      _class: 'HAS',
      fromKey: 'entity:1',
      fromType: 'entity',
      toKey: 'entity:2',
      toType: 'entity',
    }),
  ],
};

afterEach(() => {
  jest.resetAllMocks();
});

test('missing integration collect data throws missing json error', async () => {
  mockedGlobby.mockResolvedValue([]);

  await expect(retrieveIntegrationData(integrationPath)).rejects.toBeInstanceOf(
    IntegrationMissingCollectJSON,
  );
});

test('returns the json objects read from the files', async () => {
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({ relationships: integrationData.relationships });
  mockedGlobby
    .mockResolvedValueOnce([`${integrationPath}/index/entities/123.json`])
    .mockResolvedValueOnce([`${integrationPath}/index/relationships/abc.json`]);

  const result = await retrieveIntegrationData(integrationPath);

  expect(result).toEqual(integrationData);
});
