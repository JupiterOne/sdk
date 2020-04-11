import { promises as fs } from 'fs';

import { vol } from 'memfs';
import pMap from 'p-map';
import { v4 as uuid } from 'uuid';
import times from 'lodash/times';
import sortBy from 'lodash/sortBy';
import flatten from 'lodash/flatten';

import { flushDataToDisk } from '../flushDataToDisk';
import { generateEntity } from './util/graphObjects';

jest.mock('fs');

afterEach(() => vol.reset());

test('should group objects by "_type" and write them to separate files', async () => {
  const testEntityData = {
    A: times(25, () => generateEntity({ _type: 'A' })),
    B: times(25, () => generateEntity({ _type: 'B' })),
    C: times(25, () => generateEntity({ _type: 'C' })),
  };

  const allEntities = randomizeOrder(flatten(Object.values(testEntityData)));

  const cacheDirectory = '/' + uuid();
  const storageDirectoryPath = uuid();

  await flushDataToDisk({
    cacheDirectory,
    storageDirectoryPath,
    collectionType: 'entities',
    data: allEntities,
  });

  const entitiesDirectory = `${cacheDirectory}/graph/${storageDirectoryPath}/entities`;
  const entityFiles = await fs.readdir(entitiesDirectory);
  expect(entityFiles).toHaveLength(3); // matches number of types we have

  const writtenEntityBatches = await pMap(entityFiles, async (file: string) => {
    const rawData = await fs.readFile(`${entitiesDirectory}/${file}`, 'utf8');
    return JSON.parse(rawData).entities;
  });
  expect(sortBy(flatten(writtenEntityBatches), '_key')).toEqual(
    sortBy(allEntities, '_key'),
  );

  await pMap(['A', 'B', 'C'], async (entityType: string) => {
    const indexDirectory = `${cacheDirectory}/index/entities/${entityType}`;
    const indexFiles = await fs.readdir(indexDirectory);
    expect(indexFiles).toHaveLength(1);
    expect(entityFiles).toContain(indexFiles[0]);

    const rawIndexData = await fs.readFile(
      `${indexDirectory}/${indexFiles[0]}`,
      'utf8',
    );
    const parsedData = JSON.parse(rawIndexData);
    expect(sortBy(parsedData.entities, '_key')).toEqual(
      sortBy(testEntityData[entityType], '_key'),
    );
  });
});

function randomizeOrder<T>(things: T[]): T[] {
  return sortBy(things, () => Math.random());
}
