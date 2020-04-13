import { promises as fs } from 'fs';

import { vol } from 'memfs';
import { v4 as uuid } from 'uuid';
import times from 'lodash/times';

import {
  FileSystemGraphObjectStore,
  GRAPH_OBJECT_BUFFER_THRESHOLD,
} from '../FileSystemGraphObjectStore';

import { createIntegrationEntity } from '../../../data';

import { generateEntity, generateRelationship } from './util/graphObjects';

import { Entity, Relationship } from '../../../types';

jest.mock('fs');

afterEach(() => {
  vol.reset();
});

describe('flushEntitiesToDisk', () => {
  test('should write entities to the graph directory and symlink files to the index directory', async () => {
    const {
      cacheDirectory,
      storageDirectoryPath,
      store,
    } = setupLocalStepJobState();
    const entityType = uuid();
    const entities = times(25, () => generateEntity({ _type: entityType }));
    await store.addEntities(storageDirectoryPath, entities);

    await store.flushEntitiesToDisk();

    const entitiesDirectory = `${cacheDirectory}/graph/${storageDirectoryPath}/entities`;

    const storageDirectoryPathDataFiles = await fs.readdir(entitiesDirectory);
    expect(storageDirectoryPathDataFiles).toHaveLength(1);

    const writtenStepData = await fs.readFile(
      `${entitiesDirectory}/${storageDirectoryPathDataFiles[0]}`,
      'utf8',
    );
    expect(JSON.parse(writtenStepData)).toEqual({ entities });

    const stats = await fs.lstat(
      `${cacheDirectory}/index/entities/${entityType}/${storageDirectoryPathDataFiles[0]}`,
    );
    expect(stats.isSymbolicLink()).toEqual(true);

    const symlinkedData = await fs.readFile(
      `${cacheDirectory}/index/entities/${entityType}/${storageDirectoryPathDataFiles[0]}`,
      'utf8',
    );
    expect(symlinkedData).toEqual(writtenStepData);
  });
});

describe('flushRelationshipsToDisk', () => {
  test('should write relationships to the graph directory and symlink files to the index directory', async () => {
    const {
      cacheDirectory,
      storageDirectoryPath,
      store,
    } = setupLocalStepJobState();
    const relationshipType = uuid();
    const relationships = times(25, () =>
      generateRelationship({ _type: relationshipType }),
    );
    await store.addRelationships(storageDirectoryPath, relationships);

    await store.flushRelationshipsToDisk();

    const relationshipsDirectory = `${cacheDirectory}/graph/${storageDirectoryPath}/relationships`;

    const storageDirectoryPathDataFiles = await fs.readdir(
      relationshipsDirectory,
    );
    expect(storageDirectoryPathDataFiles).toHaveLength(1);

    const writtenData = await fs.readFile(
      `${relationshipsDirectory}/${storageDirectoryPathDataFiles[0]}`,
      'utf8',
    );
    expect(JSON.parse(writtenData)).toEqual({ relationships });

    const stats = await fs.lstat(
      `${cacheDirectory}/index/relationships/${relationshipType}/${storageDirectoryPathDataFiles[0]}`,
    );
    expect(stats.isSymbolicLink()).toEqual(true);

    const symlinkedData = await fs.readFile(
      `${cacheDirectory}/index/relationships/${relationshipType}/${storageDirectoryPathDataFiles[0]}`,
      'utf8',
    );
    expect(symlinkedData).toEqual(writtenData);
  });
});

describe('flush', () => {
  test('should flush both entities and relationships to disk', async () => {
    const { storageDirectoryPath, store } = setupLocalStepJobState();
    await store.addEntities(storageDirectoryPath, [generateEntity()]);
    await store.addRelationships(storageDirectoryPath, [
      generateRelationship(),
    ]);

    const flushEntitiesSpy = jest.spyOn(store, 'flushEntitiesToDisk');
    const flushRelationshipsSpy = jest.spyOn(store, 'flushRelationshipsToDisk');

    await store.flush();

    expect(flushEntitiesSpy).toHaveBeenCalledTimes(1);
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(1);
  });
});

describe('addEntities', () => {
  test('should automatically flush entities to disk after hitting a certain threshold', async () => {
    const { storageDirectoryPath, store } = setupLocalStepJobState();
    const entities = times(GRAPH_OBJECT_BUFFER_THRESHOLD - 1, () =>
      generateEntity(),
    );

    const flushEntitiesSpy = jest.spyOn(store, 'flushEntitiesToDisk');
    await store.addEntities(storageDirectoryPath, entities);

    // we have not hit the threshold yet, so flushing has not occurred
    expect(flushEntitiesSpy).toHaveBeenCalledTimes(0);

    // adding an additional entity should trigger the flushing
    await store.addEntities(storageDirectoryPath, [generateEntity()]);
    expect(flushEntitiesSpy).toHaveBeenCalledTimes(1);
  });

  test('accepts GeneratedEntity type from createIntegrationEntity utility', async () => {
    const { jobState } = setupLocalStepJobState();

    const networkAssigns = {
      _class: 'Network',
      _type: 'azure_vpc',
      public: false,
      internal: true,
    };

    const networkSourceData = {
      id: 'natural-identifier',
      environment: 'production',
      CIDR: '255.255.255.0',
      name: 'My Network',
      notInDataModel: 'Not In Data Model',
    };

    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: networkSourceData,
      },
    });

    await jobState.addEntities([entity]);
  });
});

describe('addRelationships', () => {
  test('should automatically flush relationships to disk after hitting a certain threshold', async () => {
    const { storageDirectoryPath, store } = setupLocalStepJobState();
    const relationships = times(GRAPH_OBJECT_BUFFER_THRESHOLD - 1, () =>
      generateRelationship(),
    );

    const flushRelationshipsSpy = jest.spyOn(store, 'flushRelationshipsToDisk');
    await store.addRelationships(storageDirectoryPath, relationships);

    // we have not hit the threshold yet, so flushing has not occurred
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(0);

    // adding an additional relationship should trigger the flushing
    await store.addRelationships(storageDirectoryPath, [
      generateRelationship(),
    ]);
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(1);
  });
});

describe('iterateEntities', () => {
  test('should flush buffered entities and iterate the entity "_type" index stored on disk', async () => {
    const { storageDirectoryPath, store } = setupLocalStepJobState();

    const matchingType = uuid();

    const nonMatchingEntities = times(25, () =>
      generateEntity({ _type: uuid() }),
    );
    const matchingEntities = times(25, () =>
      generateEntity({ _type: matchingType }),
    );

    await store.addEntities(storageDirectoryPath, [
      ...nonMatchingEntities,
      ...matchingEntities,
    ]);

    const collectedEntities: Entity[] = [];
    const collectEntity = (e: Entity) => {
      collectedEntities.push(e);
    };

    await store.iterateEntities({ _type: matchingType }, collectEntity);
    expect(store.entityStorageMap.totalItemCount).toEqual(0);

    expect(collectedEntities).toEqual(matchingEntities);
  });
});

describe('iterateRelationships', () => {
  test('should flush buffered relationshipos and iterate the relationship "_type" index stored on disk', async () => {
    const { storageDirectoryPath, store } = setupLocalStepJobState();

    const matchingType = uuid();

    const nonMatchingRelationships = times(25, () =>
      generateRelationship({ _type: uuid() }),
    );
    const matchingRelationships = times(25, () =>
      generateRelationship({ _type: matchingType }),
    );

    await store.addRelationships(storageDirectoryPath, [
      ...nonMatchingRelationships,
      ...matchingRelationships,
    ]);
    await store.flush();

    const collectedRelationships: Relationship[] = [];
    const collectRelationship = (r: Relationship) => {
      collectedRelationships.push(r);
    };

    await store.iterateRelationships(
      { _type: matchingType },
      collectRelationship,
    );
    expect(store.relationshipStorageMap.totalItemCount).toEqual(0);

    expect(collectedRelationships).toEqual(matchingRelationships);
  });
});

function setupLocalStepJobState() {
  const storageDirectoryPath = uuid();
  const cacheDirectory = '/' + uuid();
  const store = new FileSystemGraphObjectStore({ cacheDirectory });

  return {
    storageDirectoryPath,
    cacheDirectory,
    store,
  };
}
