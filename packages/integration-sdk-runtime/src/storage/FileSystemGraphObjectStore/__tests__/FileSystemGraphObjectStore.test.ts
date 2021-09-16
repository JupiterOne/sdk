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

import {
  createTestEntity,
  createTestRelationship,
} from '@jupiterone/integration-sdk-private-test-utils';

import {
  Entity,
  Relationship,
  createIntegrationEntity,
  createDirectRelationship,
  IntegrationStep,
} from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';
import { FlushedGraphObjectData } from '../../types';
import sortBy from 'lodash/sortBy';

jest.mock('fs');

async function getStorageDirectoryDataForStep(
  stepId: string,
): Promise<FlushedGraphObjectData> {
  const accumulatedWrittenStepData: FlushedGraphObjectData = {
    entities: [],
    relationships: [],
    mappedRelationships: [],
  };

  for (const collectionType of ['entities', 'relationships']) {
    const collectionStorageDirPath = path.join(
      getRootStorageDirectory(),
      'graph',
      stepId,
      collectionType,
    );

    let storageDirectoryPathDataFiles: string[];

    try {
      storageDirectoryPathDataFiles = await fs.readdir(
        collectionStorageDirPath,
      );
    } catch (err) {
      if (err.code === 'ENOENT') {
        continue;
      }

      throw err;
    }

    for (const fileName of storageDirectoryPathDataFiles) {
      const writtenStepData = JSON.parse(
        await fs.readFile(
          path.join(collectionStorageDirPath, fileName),
          'utf8',
        ),
      );

      if (writtenStepData.entities) {
        accumulatedWrittenStepData.entities = accumulatedWrittenStepData.entities.concat(
          writtenStepData.entities,
        );
      }

      if (writtenStepData.relationships) {
        accumulatedWrittenStepData.relationships = accumulatedWrittenStepData.relationships.concat(
          writtenStepData.relationships,
        );
      }
    }
  }

  return accumulatedWrittenStepData;
}

afterEach(() => {
  vol.reset();
});

describe('flushEntitiesToDisk', () => {
  test('should write entities to the graph directory and symlink files to the index directory', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();
    const entityType = uuid();
    const entities = times(25, () => createTestEntity({ _type: entityType }));
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
      createTestRelationship({ _type: relationshipType }),
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
    await store.addEntities(storageDirectoryPath, [createTestEntity()]);
    await store.addRelationships(storageDirectoryPath, [
      createTestRelationship(),
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
      createTestEntity(),
    );

    const flushEntitiesSpy = jest.spyOn(store, 'flushEntitiesToDisk');
    await store.addEntities(storageDirectoryPath, entities);

    // we have not hit the threshold yet, so flushing has not occurred
    expect(flushEntitiesSpy).toHaveBeenCalledTimes(0);

    // adding an additional entity should trigger the flushing
    await store.addEntities(storageDirectoryPath, [createTestEntity()]);
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
      createTestRelationship(),
    );

    const flushRelationshipsSpy = jest.spyOn(store, 'flushRelationshipsToDisk');
    await store.addRelationships(storageDirectoryPath, relationships);

    // we have not hit the threshold yet, so flushing has not occurred
    expect(flushRelationshipsSpy).toHaveBeenCalledTimes(0);

    // adding an additional relationship should trigger the flushing
    await store.addRelationships(storageDirectoryPath, [
      createTestRelationship(),
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

describe('findEntity', () => {
  test('entity should be returned from InMemoryGraphObjectStore if it has not been flushed', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

    const localGraphObjectStoreFindEntitySpy = jest.spyOn(
      (store as any).localGraphObjectStore,
      'findEntity',
    );

    const _type = uuid();
    const _key = uuid();

    const nonMatchingEntities = times(25, () => createTestEntity({ _type }));
    const matchingEntity = createTestEntity({ _type, _key });

    await store.addEntities(storageDirectoryPath, [
      ...nonMatchingEntities,
      matchingEntity,
    ]);

    await expect(store.findEntity(_key)).resolves.toEqual(matchingEntity);

    expect(localGraphObjectStoreFindEntitySpy).toHaveBeenCalledTimes(1);
    expect(localGraphObjectStoreFindEntitySpy).toHaveLastReturnedWith(
      Promise.resolve(matchingEntity),
    );
  });

  test('entity location should be returned from  when entity has been flushed from InMemoryGraphObjectStore', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

    const localGraphObjectStoreFindEntitySpy = jest.spyOn(
      (store as any).localGraphObjectStore,
      'findEntity',
    );
    const entityOnDiskLocationMapGetSpy = jest.spyOn(
      (store as any).entityOnDiskLocationMap,
      'get',
    );

    const _type = uuid();
    const _key = uuid();

    const nonMatchingEntities = times(25, () => createTestEntity({ _type }));
    const matchingEntity = createTestEntity({ _type, _key });

    await store.addEntities(storageDirectoryPath, [
      ...nonMatchingEntities,
      matchingEntity,
    ]);
    await store.flushEntitiesToDisk();

    await expect(store.findEntity(_key)).resolves.toEqual(matchingEntity);
    expect(localGraphObjectStoreFindEntitySpy).toHaveLastReturnedWith(
      Promise.resolve(undefined),
    );
    expect(entityOnDiskLocationMapGetSpy).toHaveLastReturnedWith({
      graphDataPath: expect.any(String),
      index: expect.any(Number),
    });
  });

  test('entity should not be found when non-indexable entity has been flushed from InMemoryGraphObjectStore', async () => {
    const _type = uuid();
    const _key = uuid();

    const stepId = uuid();

    const { store } = setupFileSystemObjectStore({
      integrationSteps: [
        {
          id: stepId,
          name: '',
          entities: [
            {
              _type,
              _class: '',
              resourceName: '',
              indexMetadata: { enabled: false },
            },
          ],
          relationships: [],
          executionHandler: () => {
            return;
          },
        },
      ],
    });

    const localGraphObjectStoreFindEntitySpy = jest.spyOn(
      (store as any).localGraphObjectStore,
      'findEntity',
    );
    const entityOnDiskLocationMapGetSpy = jest.spyOn(
      (store as any).entityOnDiskLocationMap,
      'get',
    );

    const nonMatchingEntities = times(25, () => createTestEntity({ _type }));
    const matchingEntity = createTestEntity({ _type, _key });

    await store.addEntities(stepId, [...nonMatchingEntities, matchingEntity]);
    await store.flushEntitiesToDisk();

    await expect(store.findEntity(_key)).resolves.toBeUndefined();
    expect(localGraphObjectStoreFindEntitySpy).toHaveLastReturnedWith(
      Promise.resolve(undefined),
    );
    expect(entityOnDiskLocationMapGetSpy).toHaveLastReturnedWith(undefined);
  });
});

describe('iterateEntities', () => {
  test('should find buffered & non-buffered entities and iterate the entity "_type" index stored on disk', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore();

    const matchingType = uuid();

    const nonMatchingEntities = times(25, () =>
      createTestEntity({ _type: uuid() }),
    );
    const matchingEntities = times(25, () =>
      createTestEntity({ _type: matchingType }),
    );

    await store.addEntities(storageDirectoryPath, [
      ...nonMatchingEntities,
      ...matchingEntities,
    ]);

    await store.flushEntitiesToDisk();

    const bufferedEntity = createTestEntity({ _type: matchingType });
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
      createTestEntity({ _type: entityType, randomField: 'field' }),
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
      createTestRelationship({ _type: uuid() }),
    );
    const matchingRelationships = times(25, () =>
      createTestRelationship({ _type: matchingType }),
    );

    await store.addRelationships(storageDirectoryPath, [
      ...nonMatchingRelationships,
      ...matchingRelationships,
    ]);
    await store.flush();

    const bufferedRelationship = createTestRelationship({
      _type: matchingType,
    });
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
      createTestRelationship({ _type: relationshipType, randomField: 'field' }),
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

    const e1 = createTestEntity();
    const e2 = createTestEntity();
    const e3 = createTestEntity();

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

    const r1 = createTestRelationship();
    const r2 = createTestRelationship();
    const r3 = createTestRelationship();

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

    const entities = times(3, () => createTestEntity());

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

  test('#flushEntitiesToDisk should respect integration step index metadata when supplied', async () => {
    const integrationStepId = uuid();

    const integrationSteps: IntegrationStep[] = [
      {
        id: integrationStepId,
        name: uuid(),
        entities: [
          {
            resourceName: 'The Group',
            _type: 'my_group',
            _class: ['Group', 'Other'],
            indexMetadata: {
              enabled: true,
            },
          },
          {
            resourceName: 'The Group',
            _type: 'my_other_group',
            _class: ['Group', 'Other'],
          },
          {
            resourceName: 'The Record',
            _type: 'my_record',
            _class: ['Record'],
            indexMetadata: {
              // Should not write this one to disk!
              enabled: false,
            },
          },
        ],
        relationships: [
          {
            _type: 'my_group',
            _class: RelationshipClass.HAS,
            sourceType: 'the_root',
            targetType: 'my_account',
            indexMetadata: {
              // Entities and relationships should be tracked by the graph
              // object store separately. This relationship has the same _type,
              // but it should not impact the indexed entity
              enabled: false,
            },
          },
        ],
        executionHandler() {
          return Promise.resolve();
        },
      },
    ];

    const { store } = setupFileSystemObjectStore({
      integrationSteps,
    });

    let flushedEntitiesCollected: Entity[] = [];
    let addEntitiesFlushCalledTimes = 0;

    const entities: Entity[] = [
      // Enabled
      createTestEntity({ _type: 'my_group' }),
      // Enabled
      createTestEntity({ _type: 'my_group' }),
      // Disabled
      createTestEntity({ _type: 'my_record' }),
      // Enabled
      createTestEntity({ _type: 'my_other_group' }),
      // Disabled
      createTestEntity({ _type: 'my_record' }),
    ];

    async function onEntitiesFlushed(entities) {
      addEntitiesFlushCalledTimes++;
      flushedEntitiesCollected = flushedEntitiesCollected.concat(entities);
      return Promise.resolve();
    }

    await store.addEntities(integrationStepId, entities, onEntitiesFlushed);
    expect(addEntitiesFlushCalledTimes).toEqual(0);
    expect(flushedEntitiesCollected).toEqual([]);

    await store.flushEntitiesToDisk(onEntitiesFlushed);
    expect(addEntitiesFlushCalledTimes).toEqual(1);

    // This should include every entity. Even the ones that are not written to
    // disk
    expect(flushedEntitiesCollected).toEqual(entities);

    const allWrittenStepData = await getStorageDirectoryDataForStep(
      integrationStepId,
    );
    expect(allWrittenStepData.entities.length).toEqual(3);
    expect(allWrittenStepData.relationships.length).toEqual(0);

    expect(sortBy(allWrittenStepData.entities, '_key')).toEqual(
      sortBy([entities[0], entities[1], entities[3]], '_key'),
    );
  });

  test('#flushRelationshipsToDisk should respect integration step index metadata when supplied', async () => {
    const integrationStepId = uuid();

    const integrationSteps: IntegrationStep[] = [
      {
        id: integrationStepId,
        name: uuid(),
        entities: [
          {
            resourceName: 'The Group',
            _type: 'my_group',
            _class: ['Group', 'Other'],
            indexMetadata: {
              // Entities and relationships should be tracked by the graph
              // object store separately. This entity has the same _type,
              // but it should not impact the indexed relationship
              enabled: false,
            },
          },
        ],
        relationships: [
          {
            _type: 'the_root_has_my_account',
            _class: RelationshipClass.HAS,
            sourceType: 'the_root',
            targetType: 'my_account',
            indexMetadata: {
              enabled: true,
            },
          },
          {
            _type: 'the_test_has_the_test_2',
            _class: RelationshipClass.HAS,
            sourceType: 'the_test',
            targetType: 'the_test_2',
          },
          {
            _type: 'the_record_has_the_record_2',
            _class: RelationshipClass.HAS,
            sourceType: 'the_record',
            targetType: 'the_record_2',
            indexMetadata: {
              // Should not write this one to disk!
              enabled: false,
            },
          },
        ],
        executionHandler() {
          return Promise.resolve();
        },
      },
    ];

    const { store } = setupFileSystemObjectStore({
      integrationSteps,
    });

    let flushedRelationshipsCollected: Relationship[] = [];
    let addRelationshipsFlushedCalledTimes = 0;

    const relationships: Relationship[] = [
      // Enabled
      createTestRelationship({ _type: 'the_root_has_my_account' }),
      // Enabled
      createTestRelationship({ _type: 'the_root_has_my_account' }),
      // Disabled
      createTestRelationship({ _type: 'the_record_has_the_record_2' }),
      // Enabled
      createTestRelationship({ _type: 'the_test_has_the_test_2' }),
      // Disabled
      createTestRelationship({ _type: 'the_record_has_the_record_2' }),
    ];

    async function onRelationshipsFlushed(relationships) {
      addRelationshipsFlushedCalledTimes++;
      flushedRelationshipsCollected = flushedRelationshipsCollected.concat(
        relationships,
      );
      return Promise.resolve();
    }

    await store.addRelationships(
      integrationStepId,
      relationships,
      onRelationshipsFlushed,
    );

    expect(addRelationshipsFlushedCalledTimes).toEqual(0);
    expect(flushedRelationshipsCollected).toEqual([]);

    await store.flushRelationshipsToDisk(onRelationshipsFlushed);
    expect(addRelationshipsFlushedCalledTimes).toEqual(1);

    // This should include every relationship. Even the ones that are not written to
    // disk
    expect(flushedRelationshipsCollected).toEqual(relationships);

    const allWrittenStepData = await getStorageDirectoryDataForStep(
      integrationStepId,
    );
    expect(allWrittenStepData.relationships.length).toEqual(3);
    expect(allWrittenStepData.entities.length).toEqual(0);

    expect(sortBy(allWrittenStepData.relationships, '_key')).toEqual(
      sortBy([relationships[0], relationships[1], relationships[3]], '_key'),
    );
  });

  test('#flushRelationshipsToDisk should call flush callback when flushRelationshipsToDisk called', async () => {
    const { storageDirectoryPath, store } = setupFileSystemObjectStore({
      graphObjectBufferThreshold: 10,
    });

    let flushedRelationshipsCollected: Relationship[] = [];
    let addRelationshipsFlushedCalledTimes = 0;

    const relationships = times(3, () => createTestRelationship());

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

    const entities = times(3, () => createTestEntity());
    const relationships = times(3, () => createTestRelationship());

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
