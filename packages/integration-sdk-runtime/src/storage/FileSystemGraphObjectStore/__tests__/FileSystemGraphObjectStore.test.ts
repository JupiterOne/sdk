import path from 'path';
import { promises as fs } from 'fs';

import { vol } from 'memfs';
import { v4 as uuid } from 'uuid';
import times from 'lodash/times';

import { getRootStorageDirectory } from '../../../fileSystem';

import {
  FileSystemGraphObjectStore,
  DEFAULT_GRAPH_OBJECT_BUFFER_THRESHOLD,
  FileSystemGraphObjectStoreParams,
} from '../FileSystemGraphObjectStore';

import { generateEntity, generateRelationship } from './util/graphObjects';

import {
  Entity,
  Relationship,
  createIntegrationEntity,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

jest.mock('fs');

afterEach(() => {
  vol.reset();
});

describe('flushEntitiesToDisk', () => {
  test('should write entities to the graph directory and symlink files to the index directory', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();
    const entityType = uuid();
    const entities = times(25, () => generateEntity({ _type: entityType }));
    await store.addEntities(storageDirectoryPath, entities);

    await store.flushEntitiesToDisk();

    const entitiesDirectory = path.join(
      getRootStorageDirectory(),
      'graph',
      storageDirectoryPath,
      'entities',
    );

    const storageDirectoryPathDataFiles = await fs.readdir(entitiesDirectory);
    expect(storageDirectoryPathDataFiles).toHaveLength(1);

    const writtenStepData = await fs.readFile(
      path.join(entitiesDirectory, storageDirectoryPathDataFiles[0]),
      'utf8',
    );
    expect(JSON.parse(writtenStepData)).toEqual({ entities });

    const expectedIndexFilePath = path.join(
      getRootStorageDirectory(),
      'index',
      'entities',
      entityType,
      storageDirectoryPathDataFiles[0],
    );

    const stats = await fs.lstat(expectedIndexFilePath);
    expect(stats.isSymbolicLink()).toEqual(true);

    const symlinkedData = await fs.readFile(expectedIndexFilePath, 'utf8');
    expect(symlinkedData).toEqual(writtenStepData);
  });
});

describe('flushRelationshipsToDisk', () => {
  test('should write relationships to the graph directory and symlink files to the index directory', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();
    const relationshipType = uuid();
    const relationships = times(25, () =>
      generateRelationship({ _type: relationshipType }),
    );
    await store.addRelationships(storageDirectoryPath, relationships);

    await store.flushRelationshipsToDisk();

    const relationshipsDirectory = path.join(
      getRootStorageDirectory(),
      'graph',
      storageDirectoryPath,
      'relationships',
    );

    const storageDirectoryPathDataFiles = await fs.readdir(
      relationshipsDirectory,
    );
    expect(storageDirectoryPathDataFiles).toHaveLength(1);

    const writtenData = await fs.readFile(
      `${relationshipsDirectory}/${storageDirectoryPathDataFiles[0]}`,
      'utf8',
    );
    expect(JSON.parse(writtenData)).toEqual({ relationships });

    const expectedIndexFilePath = path.join(
      getRootStorageDirectory(),
      'index',
      'relationships',
      relationshipType,
      storageDirectoryPathDataFiles[0],
    );

    const stats = await fs.lstat(expectedIndexFilePath);
    expect(stats.isSymbolicLink()).toEqual(true);

    const symlinkedData = await fs.readFile(expectedIndexFilePath, 'utf8');
    expect(symlinkedData).toEqual(writtenData);
  });
});

describe('flush', () => {
  test('should flush both entities and relationships to disk', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();
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
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();
    const entities = times(DEFAULT_GRAPH_OBJECT_BUFFER_THRESHOLD - 1, () =>
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
    expect.assertions(0);
    const { store } = setupFileSystemObjectStore();

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

    await store.addEntities('test', [entity]);
  });
});

describe('addRelationships', () => {
  test('should automatically flush relationships to disk after hitting a certain threshold', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();
    const relationships = times(DEFAULT_GRAPH_OBJECT_BUFFER_THRESHOLD - 1, () =>
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

  test('accepts Relationship from createDirectRelationship utility', async () => {
    expect.assertions(0);
    const { store } = setupFileSystemObjectStore();

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

    const entityA = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: networkSourceData,
      },
    });

    const entityB = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: { ...networkSourceData, id: 'other-natural-identifier' },
      },
    });

    const relationship = createDirectRelationship({
      _class: RelationshipClass.HAS,
      from: entityA,
      to: entityB,
    });

    await store.addRelationships('test', [relationship]);
  });
});

describe('getEntity', () => {
  test('should find buffered entities and get an entity by "_type" and "_key"', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

    const _type = uuid();
    const _key = uuid();

    const nonMatchingEntities = times(25, () => generateEntity({ _type }));
    const matchingEntity = generateEntity({ _type, _key });

    await store.addEntities(storageDirectoryPath, [
      ...nonMatchingEntities,
      matchingEntity,
    ]);

    const entity = await store.getEntity({ _key, _type });
    expect(entity).toEqual(matchingEntity);
  });

  test('should find non-buffered entities and get an entity by "_type" and "_key"', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 2,
    });

    const _type = uuid();

    const entities = times(2, () => generateEntity({ _type }));
    await store.addEntities(storageDirectoryPath, entities);

    const entity = await store.getEntity({ _key: entities[1]._key, _type });
    expect(entity).toEqual(entities[1]);
  });
});

describe('iterateEntities', () => {
  test('should find buffered & non-buffered entities and iterate the entity "_type" index stored on disk', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

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

    await store.flushEntitiesToDisk();

    const bufferedEntity = generateEntity({ _type: matchingType });
    await store.addEntities(storageDirectoryPath, [bufferedEntity]);

    const collectedEntities = new Map<string, Entity>();
    const collectEntity = (e: Entity) => {
      if (collectedEntities.has(e._key)) {
        throw new Error(
          `duplicate entity _key found in iterateEntities (_key=${e._key})`,
        );
      }
      collectedEntities.set(e._key, e);
    };

    await store.iterateEntities({ _type: matchingType }, collectEntity);
    expect(Array.from(collectedEntities.values())).toEqual([
      bufferedEntity,
      ...matchingEntities,
    ]);
  });

  test('should allow extended types to be iterated', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

    const entityType = uuid();

    type TestEntity = Entity & { randomField: string };

    const entities = times(25, () =>
      generateEntity({ _type: entityType, randomField: 'field' }),
    );

    await store.addEntities(storageDirectoryPath, entities);

    const collectedEntities: TestEntity[] = [];
    const collectEntity = (e: TestEntity) => {
      collectedEntities.push(e);
    };

    await store.iterateEntities<TestEntity>(
      { _type: entityType },
      collectEntity,
    );

    expect(collectedEntities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          randomField: 'field',
        }),
      ]),
    );
  });
});

describe('iterateRelationships', () => {
  test('should find buffered & non-buffered relationshipos and iterate the relationship "_type" index stored on disk', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

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

    const bufferedRelationship = generateRelationship({ _type: matchingType });
    await store.addRelationships(storageDirectoryPath, [bufferedRelationship]);

    const collectedRelationships = new Map<string, Relationship>();
    const collectRelationship = (r: Relationship) => {
      if (collectedRelationships.has(r._key)) {
        throw new Error(
          `duplicate relationship_key found in iterateRelationships (_key=${r._key})`,
        );
      }
      collectedRelationships.set(r._key, r);
    };

    await store.iterateRelationships(
      { _type: matchingType },
      collectRelationship,
    );
    expect(Array.from(collectedRelationships.values())).toEqual([
      bufferedRelationship,
      ...matchingRelationships,
    ]);
  });

  test('should allow extended types to be iterated', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

    const relationshipType = uuid();

    type TestRelationship = Relationship & { randomField: string };

    const relationships = times(25, () =>
      generateRelationship({ _type: relationshipType, randomField: 'field' }),
    );

    await store.addRelationships(storageDirectoryPath, relationships);

    const collectedRelationships: TestRelationship[] = [];
    const collectRelationship = (e: TestRelationship) => {
      collectedRelationships.push(e);
    };

    await store.iterateRelationships<TestRelationship>(
      { _type: relationshipType },
      collectRelationship,
    );

    expect(collectedRelationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          randomField: 'field',
        }),
      ]),
    );
  });
});

describe('flush callbacks', () => {
  test('#addEntity should call flush callback when buffer threshold reached', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 2,
    });

    let flushedEntitiesCollected: Entity[] = [];
    let addEntitiesFlushCalledTimes = 0;

    const e1 = generateEntity();
    const e2 = generateEntity();
    const e3 = generateEntity();

    await store.addEntities(storageDirectoryPath, [e1], async (entities) => {
      // Should not call first time because `graphObjectBufferThreshold` = 2
      addEntitiesFlushCalledTimes++;
      flushedEntitiesCollected = flushedEntitiesCollected.concat(entities);
      return Promise.resolve();
    });

    await store.addEntities(
      storageDirectoryPath,
      [e2, e3],
      async (entities) => {
        // Should not call first time because `graphObjectBufferThreshold` = 2
        addEntitiesFlushCalledTimes++;
        flushedEntitiesCollected = flushedEntitiesCollected.concat(entities);
        return Promise.resolve();
      },
    );

    expect(addEntitiesFlushCalledTimes).toEqual(1);
    expect(flushedEntitiesCollected).toEqual([e1, e2, e3]);
  });

  test('#addRelationships should call flush callback when buffer threshold reached', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 2,
    });

    let flushedRelationshipsCollected: Relationship[] = [];
    let addRelationshipsFlushCalledTimes = 0;

    const r1 = generateRelationship();
    const r2 = generateRelationship();
    const r3 = generateRelationship();

    await store.addRelationships(
      storageDirectoryPath,
      [r1],
      async (relationships) => {
        // Should not call first time because `graphObjectBufferThreshold` = 2
        addRelationshipsFlushCalledTimes++;
        flushedRelationshipsCollected = flushedRelationshipsCollected.concat(
          relationships,
        );
        return Promise.resolve();
      },
    );

    await store.addRelationships(
      storageDirectoryPath,
      [r2, r3],
      async (relationships) => {
        // Should not call first time because `graphObjectBufferThreshold` = 2
        addRelationshipsFlushCalledTimes++;
        flushedRelationshipsCollected = flushedRelationshipsCollected.concat(
          relationships,
        );
        return Promise.resolve();
      },
    );

    expect(addRelationshipsFlushCalledTimes).toEqual(1);
    expect(flushedRelationshipsCollected).toEqual([r1, r2, r3]);
  });

  test('#flushEntitiesToDisk should call flush callback when flushEntitiesToDisk called', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 10,
    });

    let flushedEntitiesCollected: Entity[] = [];
    let addEntitiesFlushCalledTimes = 0;

    const entities = times(3, () => generateEntity());

    async function onEntitiesFlushed(entities) {
      addEntitiesFlushCalledTimes++;
      flushedEntitiesCollected = flushedEntitiesCollected.concat(entities);
      return Promise.resolve();
    }

    await store.addEntities(storageDirectoryPath, entities, onEntitiesFlushed);

    expect(addEntitiesFlushCalledTimes).toEqual(0);
    expect(flushedEntitiesCollected).toEqual([]);

    await store.flushEntitiesToDisk(onEntitiesFlushed);

    expect(addEntitiesFlushCalledTimes).toEqual(1);
    expect(flushedEntitiesCollected).toEqual(entities);
  });

  test('#flushRelationshipsToDisk should call flush callback when flushRelationshipsToDisk called', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 10,
    });

    let flushedRelationshipsCollected: Relationship[] = [];
    let addRelationshipsFlushedCalledTimes = 0;

    const relationships = times(3, () => generateRelationship());

    async function onRelationshipsFlushed(relationships) {
      addRelationshipsFlushedCalledTimes++;
      flushedRelationshipsCollected = flushedRelationshipsCollected.concat(
        relationships,
      );
      return Promise.resolve();
    }

    await store.addRelationships(
      storageDirectoryPath,
      relationships,
      onRelationshipsFlushed,
    );

    expect(addRelationshipsFlushedCalledTimes).toEqual(0);
    expect(flushedRelationshipsCollected).toEqual([]);

    await store.flushRelationshipsToDisk(onRelationshipsFlushed);

    expect(addRelationshipsFlushedCalledTimes).toEqual(1);
    expect(flushedRelationshipsCollected).toEqual(relationships);
  });

  test('#flush should call both entity and relationship flush callbacks when flush called', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 10,
    });

    let flushedRelationshipsCollected: Relationship[] = [];
    let addRelationshipsFlushedCalledTimes = 0;

    let flushedEntitiesCollected: Entity[] = [];
    let addEntitiesFlushCalledTimes = 0;

    const entities = times(3, () => generateEntity());
    const relationships = times(3, () => generateRelationship());

    async function onEntitiesFlushed(entities) {
      addEntitiesFlushCalledTimes++;
      flushedEntitiesCollected = flushedEntitiesCollected.concat(entities);
      return Promise.resolve();
    }

    async function onRelationshipsFlushed(relationships) {
      addRelationshipsFlushedCalledTimes++;
      flushedRelationshipsCollected = flushedRelationshipsCollected.concat(
        relationships,
      );
      return Promise.resolve();
    }

    await store.addRelationships(
      storageDirectoryPath,
      relationships,
      onRelationshipsFlushed,
    );
    await store.addEntities(storageDirectoryPath, entities, onEntitiesFlushed);
    await store.flush(onEntitiesFlushed, onRelationshipsFlushed);

    expect(addEntitiesFlushCalledTimes).toEqual(1);
    expect(addRelationshipsFlushedCalledTimes).toEqual(1);
    expect(flushedEntitiesCollected).toEqual(entities);
    expect(flushedRelationshipsCollected).toEqual(relationships);
  });
});

function setupFileSystemObjectStore(params?: FileSystemGraphObjectStoreParams) {
  const storageDirectoryPath = uuid();
  const store = new FileSystemGraphObjectStore(params);

  return {
    storageDirectoryPath,
    store,
  };
}
