import { mocked } from 'ts-jest/utils';
import ora from 'ora';

import {
  exportAssetsToJson,
  ExportAssetsToJsonParams,
} from '../exportAssetsToJson';
import { DEFAULT_EXPORT_DIRECTORY } from '../../commands';
import { bulkDownloadToJson } from '../bulkDownloadToJson';
import * as log from '../../log';
import { TEST_API_KEY } from '../../__tests__/utils';

jest.mock('../bulkDownloadToJson');
jest.mock('../../log');
jest.mock('ora');

const mockedBulkDownload = mocked(bulkDownloadToJson, true);
const mockedSpinner = ora().start();

const options: ExportAssetsToJsonParams = {
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
  expect(mockedSpinner.succeed).toHaveBeenCalledWith(
    expect.stringMatching(
      /Export Successful, Downloaded \d+ entities and \d+ relationships!/g,
    ),
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
  expect(mockedSpinner.fail).toHaveBeenCalledWith(
    'Failed to export assets to JSON',
  );
});
