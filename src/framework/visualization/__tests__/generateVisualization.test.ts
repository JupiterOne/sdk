import { generateVisualization } from '../generateVisualization';
import { mocked } from 'ts-jest/utils';
import globby from 'globby';
import { IntegrationData } from '../types/IntegrationData';
import { readJsonFile, getRootStorageDirectory } from '../../../fileSystem';
import path from 'path';
import { vol } from 'memfs';

jest.mock('globby');
jest.mock('../../../fileSystem');
jest.mock('fs');

const mockedGlobby = mocked(globby);
const mockedReadJson = mocked(readJsonFile);
const mockedGetRootStorageDirectory = mocked(getRootStorageDirectory);

const integrationPath = '/j1-integration';
const integrationData: IntegrationData = {
  entities: [
    {
      id: '1',
      _class: 'entity',
      _key: 'entity:1',
      _type: 'entity',
      name: 'Entity Name',
    },
  ],
  relationships: [],
};

beforeEach(() => {
  mockedGetRootStorageDirectory.mockReturnValue(integrationPath);
  vol.mkdirSync(integrationPath, { recursive: true });
});

test('returns html path when writing the file is successful', async () => {
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({ relationships: integrationData.relationships });
  mockedGlobby
    .mockResolvedValueOnce([`${integrationPath}/index/entities/123.json`])
    .mockResolvedValueOnce([`${integrationPath}/index/relationships/abc.json`]);

  const htmlPath = await generateVisualization();

  expect(vol.toJSON()).toEqual({
    [htmlPath.replace(/\\/g, '/')]: expect.any(String),
  });
  expect(htmlPath).toBe(path.join(integrationPath, 'index.html'));
});
