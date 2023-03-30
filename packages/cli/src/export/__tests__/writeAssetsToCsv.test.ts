import { vol } from 'memfs';
import { randomUUID as uuid } from 'crypto';

import { groupJsonAssetsByType } from '../groupJsonAssetsByType';
import { TEST_STORAGE_LOCATION } from '../../__tests__/utils';
import { writeAssetsToCsv } from '../writeAssetsToCsv';
import { createEntity } from './utils/createEntity';
import { sanitizeContent } from '../util';

jest.mock('fs');

test('should write assets to csv files by given types', async () => {
  vol.fromJSON({
    [`${TEST_STORAGE_LOCATION}/json/entities/entity_type_1/${uuid()}.json`]:
      JSON.stringify([
        createEntity({ id: '1', type: '1' }),
        createEntity({ id: '2', type: '1' }),
      ]),
    [`${TEST_STORAGE_LOCATION}/json/entities/entity_type_2/${uuid()}.json`]:
      JSON.stringify([
        createEntity({ id: '3', type: '2' }),
        createEntity({ id: '4', type: '2' }),
      ]),
  });

  await writeAssetsToCsv({
    groupedAssetFiles: await groupJsonAssetsByType({
      assetDirectory: TEST_STORAGE_LOCATION,
    }),
    directory: `${TEST_STORAGE_LOCATION}/csv/entities`,
  });

  expect(
    Object.values(vol.toJSON()).map((content) => content?.replace(/\r/g, '')), // remove \r that windows generates
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining(`id,name,displayName,createdOn,_class,_type,_key
entity-1,Entity 1,Entity 1,1591831808891,Entity,entity_type_1,entity-1
entity-2,Entity 2,Entity 2,1591831808892,Entity,entity_type_1,entity-2`),
      expect.stringContaining(`id,name,displayName,createdOn,_class,_type,_key
entity-3,Entity 3,Entity 3,1591831808893,Entity,entity_type_2,entity-3
entity-4,Entity 4,Entity 4,1591831808894,Entity,entity_type_2,entity-4`),
    ]),
  );
});
