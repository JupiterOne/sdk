import ora from 'ora';
import { vol } from 'memfs';
import { v4 as uuid } from 'uuid';
import csvToJson from 'csvtojson';

import { DEFAULT_EXPORT_DIRECTORY } from '../../commands';
import { exportJsonAssetsToCsv } from '../exportJsonAssetsToCsv';
import { createEntity } from './utils/createEntity';
import { createRelationship } from './utils/createRelationship';
import * as log from '../../log';
import { fetchAssetsContents } from '../../__tests__/utils/fetchAssetsContents';
import { TEST_API_KEY } from '../../__tests__/utils';

jest.mock('fs');
jest.mock('../../log');
jest.mock('ora');

const mockedSpinner = ora().start();
const TEST_DIRECTORY = DEFAULT_EXPORT_DIRECTORY;
const TEST_FILES = {
  [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]:
    JSON.stringify([createEntity({ id: '1', type: '1' })]),
  [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]:
    JSON.stringify([createEntity({ id: '2', type: '1' })]),
  [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]:
    JSON.stringify([createEntity({ id: '3', type: '2' })]),
  [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]:
    JSON.stringify([
      createEntity({ id: '4', type: '2' }),
      createEntity({ id: '5', type: '2' }),
    ]),
  [`${TEST_DIRECTORY}/json/relationships/relationship_type_1/${uuid()}.json`]:
    JSON.stringify([
      createRelationship({
        from: createEntity({ id: '1', type: '1' }),
        to: createEntity({ id: '3', type: '2' }),
      }),
      createRelationship({
        from: createEntity({ id: '2', type: '1' }),
        to: createEntity({ id: '3', type: '2' }),
      }),
    ]),
  [`${TEST_DIRECTORY}/json/relationships/relationship_type_2/${uuid()}.json`]:
    JSON.stringify([
      createRelationship({
        from: createEntity({ id: '4', type: '2' }),
        to: createEntity({ id: '2', type: '1' }),
      }),
    ]),
};

beforeEach(() => {
  vol.reset();
});

test('should not export anything if there are no json assets', async () => {
  await exportJsonAssetsToCsv({
    includeEntities: true,
    includeRelationships: true,
    storageDirectory: TEST_DIRECTORY,
    apiKey: TEST_API_KEY,
  });

  expect(vol.toJSON()).toEqual({});
});

test('should export both entities and relationships when specified', async () => {
  vol.fromJSON(TEST_FILES);

  await exportJsonAssetsToCsv({
    includeEntities: true,
    includeRelationships: true,
    storageDirectory: TEST_DIRECTORY,
    apiKey: TEST_API_KEY,
  });
  const assets = await Promise.all(
    fetchAssetsContents(vol).map(convertCsvToJson),
  );

  expect(assets).toEqual(
    expect.arrayContaining([
      [createEntity({ id: '1', type: '1' })],
      [createEntity({ id: '2', type: '1' })],
      [createEntity({ id: '3', type: '2' })],
      [
        createEntity({ id: '4', type: '2' }),
        createEntity({ id: '5', type: '2' }),
      ],
      [
        createRelationship({
          from: createEntity({ id: '1', type: '1' }),
          to: createEntity({ id: '3', type: '2' }),
        }),
        createRelationship({
          from: createEntity({ id: '2', type: '1' }),
          to: createEntity({ id: '3', type: '2' }),
        }),
      ],
      [
        createRelationship({
          from: createEntity({ id: '4', type: '2' }),
          to: createEntity({ id: '2', type: '1' }),
        }),
      ],
    ]),
  );
  expect(assets).toHaveLength(6);
});

test('should export only entities when includeRelationships is false', async () => {
  vol.fromJSON(TEST_FILES);

  await exportJsonAssetsToCsv({
    includeEntities: true,
    includeRelationships: false,
    storageDirectory: TEST_DIRECTORY,
    apiKey: TEST_API_KEY,
  });

  const assets = await Promise.all(
    fetchAssetsContents(vol).map(convertCsvToJson),
  );

  expect(assets).toEqual(
    expect.arrayContaining([
      [createEntity({ id: '1', type: '1' })],
      [createEntity({ id: '2', type: '1' })],
      [createEntity({ id: '3', type: '2' })],
      [
        createEntity({ id: '4', type: '2' }),
        createEntity({ id: '5', type: '2' }),
      ],
    ]),
  );
  expect(assets).toHaveLength(4);
});

test('should export only relationships when includeEntities is false', async () => {
  vol.fromJSON(TEST_FILES);

  await exportJsonAssetsToCsv({
    includeEntities: false,
    includeRelationships: true,
    storageDirectory: TEST_DIRECTORY,
    apiKey: TEST_API_KEY,
  });

  const assets = await Promise.all(
    fetchAssetsContents(vol).map(convertCsvToJson),
  );

  expect(assets).toEqual(
    expect.arrayContaining([
      [
        createRelationship({
          from: createEntity({ id: '1', type: '1' }),
          to: createEntity({ id: '3', type: '2' }),
        }),
        createRelationship({
          from: createEntity({ id: '2', type: '1' }),
          to: createEntity({ id: '3', type: '2' }),
        }),
      ],
      [
        createRelationship({
          from: createEntity({ id: '4', type: '2' }),
          to: createEntity({ id: '2', type: '1' }),
        }),
      ],
    ]),
  );

  expect(assets).toHaveLength(2);
});

test('should log error when export fails', async () => {
  vol.fromJSON({
    [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]: '{;}',
  });

  await expect(
    exportJsonAssetsToCsv({
      includeEntities: true,
      includeRelationships: true,
      storageDirectory: TEST_DIRECTORY,
      apiKey: TEST_API_KEY,
    }),
  ).rejects.toThrow(/Unexpected token/g);
  expect(log.error).toHaveBeenCalledWith('Failed to export JSON assets to CSV');
  expect(mockedSpinner.fail).toHaveBeenCalledWith(
    'Failed to export JSON assets to CSV',
  );
});

function convertCsvToJson(content: string) {
  return csvToJson({ checkType: true }).fromString(content);
}
