import globby from 'globby';
import path from 'path';

import {
  getRootStorageDirectory,
  readJsonFromPath,
  writeFileToPath,
} from '@jupiterone/integration-sdk-runtime';

import * as log from '../../log';
import { nothingToDisplayMessage } from '../../utils/generateVisHTML';
import { generateVisualization } from '../generateVisualization';
import { IntegrationData } from '../types/IntegrationData';

jest.mock('fs');
jest.mock('globby');
jest.mock('@jupiterone/integration-sdk-runtime');
jest.mock('../../log');

const mockedGlobby = jest.mocked(globby);
const mockedReadJson = jest.mocked(readJsonFromPath);
const mockedGetRootStorageDirectory = jest.mocked(getRootStorageDirectory);

const integrationPath = path.resolve(process.cwd(), '.j1-integration');
const dataPath = path.resolve(integrationPath, 'graph');
const visualizationOutputPath = path.resolve(
  process.cwd(),
  '.j1-integration',
  'graph',
  'index.html',
);
const integrationData: IntegrationData = {
  entities: [
    {
      id: '1',
      _class: 'entity',
      _key: 'entity:1',
      _type: 'entity',
      displayName: 'Entity Name',
    },
  ],
  relationships: [],
  mappedRelationships: [],
};

beforeEach(() => {
  mockedGetRootStorageDirectory.mockReturnValue(integrationPath);
});

test('returns html path when writing the file is successful', async () => {
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({ relationships: integrationData.relationships });
  mockedGlobby.mockResolvedValueOnce([
    `${dataPath}/index/entities/123.json`,
    `${dataPath}/index/relationships/abc.json`,
  ]);

  await generateVisualization(dataPath, visualizationOutputPath);

  expect(writeFileToPath).toBeCalledWith({
    path: visualizationOutputPath,
    content: expect.any(String),
  });
});

test('returns empty html when there are no json files', async () => {
  mockedGlobby.mockResolvedValueOnce([]);

  await generateVisualization(dataPath, visualizationOutputPath);

  expect(log.warn).toHaveBeenCalledWith(
    `Unable to find any files under path: ${path.resolve(
      process.cwd(),
      dataPath,
    )}`,
  );
  expect(writeFileToPath).toBeCalledWith({
    path: visualizationOutputPath,
    content: expect.stringContaining(nothingToDisplayMessage),
  });
});
