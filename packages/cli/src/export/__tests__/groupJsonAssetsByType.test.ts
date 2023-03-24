import { vol } from 'memfs';
import { randomUUID as uuid } from 'crypto';

import { groupJsonAssetsByType } from '../groupJsonAssetsByType';
import { DEFAULT_EXPORT_DIRECTORY } from '../../commands';

jest.mock('fs');

const TEST_DIRECTORY = `${DEFAULT_EXPORT_DIRECTORY}/json`;

beforeEach(() => {
  vol.reset();
});

test('should return nothing if there are no files found', async () => {
  await expect(
    groupJsonAssetsByType({ assetDirectory: TEST_DIRECTORY }),
  ).resolves.toEqual({});
});

test('should group assets by type', async () => {
  vol.fromJSON({
    [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_1/${uuid()}.json`]: '{}',

    [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]: '{}',
    [`${TEST_DIRECTORY}/json/entities/entity_type_2/${uuid()}.json`]: '{}',
  });

  const batchedAssetFiles = await groupJsonAssetsByType({
    assetDirectory: TEST_DIRECTORY,
  });

  expect(batchedAssetFiles.entity_type_1).toHaveLength(5);
  expect(batchedAssetFiles.entity_type_2).toHaveLength(6);
});
