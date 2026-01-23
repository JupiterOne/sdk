import * as runtime from '@jupiterone/integration-sdk-runtime';
import { randomUUID as uuid } from 'crypto';

import * as fileSystem from '../../fileSystem';
import {
  bulkDownloadToJson,
  BulkDownloadParams,
  ASSET_DOWNLOAD_LIMIT,
} from '../bulkDownloadToJson';
import { DEFAULT_EXPORT_DIRECTORY } from '../../commands';
import { Entity } from '@jupiterone/integration-sdk-core';
import { TEST_API_KEY, TEST_ACCOUNT } from '../../__tests__/utils';

jest.mock('@jupiterone/integration-sdk-runtime');
jest.mock('../../fileSystem');

const mockedRuntime = jest.mocked(runtime);
const mockedFileSystem = jest.mocked(fileSystem);

const mockGet = jest.fn();
const mockApiClient = {
  get: mockGet,
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};

const options: BulkDownloadParams = {
  apiBaseUrl: '',
  account: TEST_ACCOUNT,
  apiKey: TEST_API_KEY,
  assetType: 'entities',
  includeDeleted: true,
  progress: jest.fn(),
  storageDirectory: DEFAULT_EXPORT_DIRECTORY,
};

function createEntity(id: string, type: string): Entity {
  return {
    _class: 'Entity',
    _key: `entity-${id}`,
    _type: type,
    _rawData: [],
    displayName: `Entity ${id}`,
    id,
  };
}

beforeEach(() => {
  mockGet.mockReset();
  mockedRuntime.createApiClient.mockReturnValue(mockApiClient as any);
});

test('should write assets to json file', async () => {
  const entities: Entity[] = [
    createEntity('1', 'test_1'),
    createEntity('2', 'test_1'),
    createEntity('3', 'test_2'),
    createEntity('4', 'test_2'),
  ];
  mockGet.mockResolvedValue({
    data: { items: entities },
  });
  await bulkDownloadToJson(options);

  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(mockGet).toHaveBeenCalledWith(
    `/entities?limit=${ASSET_DOWNLOAD_LIMIT}&includeDeleted=true`,
  );
  expect(mockedFileSystem.writeFileToPath).toHaveBeenCalledTimes(2);
  expect(mockedFileSystem.writeFileToPath).toHaveBeenCalledWith({
    filePath: expect.stringMatching(
      /\.j1.{1,2}export.{1,2}json.{1,2}entities.{1,2}test_1.*\.json/,
    ),
    content: JSON.stringify([entities[0], entities[1]]),
  });
  expect(mockedFileSystem.writeFileToPath).toHaveBeenCalledWith({
    filePath: expect.stringMatching(
      /\.j1.{1,2}export.{1,2}json.{1,2}entities.{1,2}test_2.*\.json/,
    ),
    content: JSON.stringify([entities[2], entities[3]]),
  });
});

test('should cursor over results from the api and track progress', async () => {
  const entities: Entity[] = [
    createEntity('1', 'test_1'),
    createEntity('2', 'test_1'),
    createEntity('3', 'test_2'),
    createEntity('4', 'test_2'),
  ];
  const endCursor = uuid();
  mockGet
    .mockResolvedValueOnce({
      data: {
        items: [entities[0], entities[1]],
        endCursor,
      },
    })
    .mockResolvedValueOnce({
      data: { items: [entities[2], entities[3]] },
    });

  await bulkDownloadToJson(options);

  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(mockGet).toHaveBeenCalledWith(
    `/entities?limit=${ASSET_DOWNLOAD_LIMIT}&includeDeleted=true`,
  );
  expect(mockGet).toHaveBeenCalledWith(
    `/entities?limit=${ASSET_DOWNLOAD_LIMIT}&includeDeleted=true&cursor=${endCursor}`,
  );
  expect(options.progress).toHaveBeenCalledTimes(2);
  expect(options.progress).toHaveBeenCalledWith(2);
  expect(options.progress).toHaveBeenCalledWith(4);
});

test('should handle 422 large response body', async () => {
  const entities: Entity[] = [
    createEntity('1', 'test_1'),
    createEntity('2', 'test_1'),
    createEntity('3', 'test_2'),
    createEntity('4', 'test_2'),
  ];
  const endCursor = uuid();
  mockGet
    .mockRejectedValueOnce({
      response: {
        status: 422,
      },
    })
    .mockResolvedValueOnce({
      data: {
        items: [entities[0], entities[1]],
        endCursor,
      },
    })
    .mockResolvedValueOnce({
      data: { items: [entities[2], entities[3]] },
    });

  await bulkDownloadToJson(options);

  expect(mockGet).toHaveBeenCalledTimes(3);
  expect(mockGet).toHaveBeenCalledWith(
    `/entities?limit=${ASSET_DOWNLOAD_LIMIT}&includeDeleted=true`,
  );
  expect(mockGet).toHaveBeenCalledWith(
    `/entities?limit=${ASSET_DOWNLOAD_LIMIT / 2}&includeDeleted=true`,
  );
  expect(mockGet).toHaveBeenCalledWith(
    `/entities?limit=${ASSET_DOWNLOAD_LIMIT}&includeDeleted=true&cursor=${endCursor}`,
  );
});
