import { mocked } from 'jest-mock';
import { exportAssetsToJson } from '../exportAssetsToJson';
import { DEFAULT_EXPORT_DIRECTORY } from '../../commands';
import { bulkDownloadToJson } from '../bulkDownloadToJson';
import * as log from '../../log';
import { TEST_API_KEY } from '../../__tests__/utils';
import { ExportAssetsParams } from '../exportAssets';
import { randomUUID } from 'crypto';

jest.mock('../bulkDownloadToJson');
jest.mock('../../log');

jest.mock('ora', () => {
  return () => {
    return {
      start: jest.fn().mockReturnThis(),
      stop: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };
  };
});

const mockedBulkDownload = mocked(bulkDownloadToJson);

const options: ExportAssetsParams = {
  account: randomUUID(),
  storageDirectory: DEFAULT_EXPORT_DIRECTORY,
  includeDeleted: true,
  includeEntities: true,
  includeRelationships: true,
  apiKey: TEST_API_KEY,
};

test('should download both entities and relationships when specified to include them', async () => {
  await exportAssetsToJson(options);

  expect(bulkDownloadToJson).toHaveBeenCalledTimes(2);
  expect(bulkDownloadToJson).toHaveBeenCalledWith(
    expect.objectContaining({
      storageDirectory: options.storageDirectory,
      apiKey: options.apiKey,
      includeDeleted: options.includeDeleted,
      assetType: 'entities',
      progress: expect.anything(),
    }),
  );
  expect(bulkDownloadToJson).toHaveBeenCalledWith(
    expect.objectContaining({
      storageDirectory: options.storageDirectory,
      apiKey: options.apiKey,
      includeDeleted: options.includeDeleted,
      assetType: 'relationships',
      progress: expect.anything(),
    }),
  );
});

test('should exclude entities when includeEntities is false', async () => {
  await exportAssetsToJson({
    ...options,
    includeEntities: false,
  });

  expect(bulkDownloadToJson).toHaveBeenCalledTimes(1);
  expect(bulkDownloadToJson).toHaveBeenCalledWith(
    expect.objectContaining({
      storageDirectory: options.storageDirectory,
      apiKey: options.apiKey,
      includeDeleted: options.includeDeleted,
      assetType: 'relationships',
      progress: expect.anything(),
    }),
  );
});

test('should exclude relationships when includeRelationships is false', async () => {
  await exportAssetsToJson({
    ...options,
    includeRelationships: false,
  });

  expect(bulkDownloadToJson).toHaveBeenCalledTimes(1);
  expect(bulkDownloadToJson).toHaveBeenCalledWith(
    expect.objectContaining({
      storageDirectory: options.storageDirectory,
      apiKey: options.apiKey,
      includeDeleted: options.includeDeleted,
      assetType: 'entities',
      progress: expect.anything(),
    }),
  );
});

test('should log error when there is an issue bulk downloading', async () => {
  const error = new Error();
  mockedBulkDownload.mockRejectedValue(error);

  await expect(exportAssetsToJson(options)).rejects.toThrow(error);
  expect(log.error).toHaveBeenCalledWith('Failed to export assets to JSON');
});
