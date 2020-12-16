import {
  createStepJobState,
  DuplicateKeyTracker,
  TypeTracker,
  MemoryDataStore,
  CreateStepJobStateParams,
} from '../jobState';
import { v4 as uuid } from 'uuid';
import { FileSystemGraphObjectStore } from '../../storage';
import { vol } from 'memfs';
import { Entity } from '@jupiterone/integration-sdk-core';
import {
  createTestEntity,
  createTestRelationship,
  sleep,
} from '@jupiterone/integration-sdk-private-test-utils';
import {
  createQueuedStepGraphObjectDataUploader,
  CreateQueuedStepGraphObjectDataUploaderParams,
} from '../uploader';
import { FlushedGraphObjectData } from '../../storage/types';

jest.mock('fs');

function createInMemoryStepGraphObjectDataUploaderCollector(
  partial?: CreateQueuedStepGraphObjectDataUploaderParams,
) {
  const graphObjectDataCollection: FlushedGraphObjectData[] = [];

  const uploader = createQueuedStepGraphObjectDataUploader({
    stepId: uuid(),
    uploadConcurrency: 5,
    upload(graphObjectData) {
      graphObjectDataCollection.push(graphObjectData);
      return Promise.resolve();
    },
    ...partial,
  });

  return {
    uploader,
    graphObjectDataCollection,
  };
}

function getMockCreateStepJobStateParams(
  partial?: Partial<CreateStepJobStateParams>,
): CreateStepJobStateParams {
  return {
    stepId: uuid(),
    graphObjectStore: new FileSystemGraphObjectStore(),
    duplicateKeyTracker: new DuplicateKeyTracker(),
    typeTracker: new TypeTracker(),
    dataStore: new MemoryDataStore(),
    ...partial,
  };
}

function createTestStepJobState(params?: Partial<CreateStepJobStateParams>) {
  return createStepJobState(getMockCreateStepJobStateParams(params));
}

describe('#createStepJobState', () => {
  afterEach(() => {
    vol.reset();
  });

  test('should allow creating job state and adding a single entity with "addEntity"', async () => {
    const jobState = createTestStepJobState();
    const entity: Entity = {
      _type: 'a_entity',
      _class: 'A',
      _key: 'a',
    };

    const result = await jobState.addEntity(entity);
    expect(result).toBe(entity);
  });

  test('should allow creating job state and adding a multiple entities with "addEntities"', async () => {
    const jobState = createTestStepJobState();
    const entities: Entity[] = [
      {
        _type: 'a_entity',
        _class: 'A',
        _key: 'a',
      },
      {
        _type: 'a_entity2',
        _class: 'B',
        _key: 'b',
      },
    ];

    const result = await jobState.addEntities(entities);
    expect(result).toBe(entities);
  });
});

describe('#findEntity', () => {
  afterEach(() => {
    vol.reset();
  });

  test('should find entity by _key', async () => {
    const jobState = createTestStepJobState();
    const entity: Entity = {
      _type: 'a_entity',
      _class: 'A',
      _key: 'a',
    };

    await jobState.addEntity(entity);
    expect(await jobState.findEntity('a')).toStrictEqual(entity);
  });

  test('should find entity by _key with key normalization', async () => {
    const jobState = createTestStepJobState({
      duplicateKeyTracker: new DuplicateKeyTracker((_key) =>
        _key.toLowerCase(),
      ),
    });

    const entity: Entity = {
      _type: 'a_entity',
      _class: 'A',
      _key: 'INCONSISTENT-casing',
    };

    await jobState.addEntity(entity);
    expect(await jobState.findEntity('inconsistent-CASING')).toStrictEqual(
      entity,
    );
  });

  test('should return "null" if entity not found', async () => {
    const jobState = createTestStepJobState();
    expect(await jobState.findEntity('invalid-entity-key')).toEqual(null);
  });
});

describe('upload callbacks', () => {
  test('#addEntities should call uploader enqueue on flushed', async () => {
    const uploadCollector = createInMemoryStepGraphObjectDataUploaderCollector();
    const jobState = createTestStepJobState({
      graphObjectStore: new FileSystemGraphObjectStore({
        graphObjectBufferThreshold: 2,
      }),
      uploader: uploadCollector.uploader,
    });

    const e1 = createTestEntity();
    const e2 = createTestEntity();

    await jobState.addEntities([e1]);
    await jobState.addEntities([e2]);

    const expectedUploaded: FlushedGraphObjectData[] = [
      {
        entities: [e1, e2],
        relationships: [],
      },
    ];

    expect(uploadCollector.graphObjectDataCollection).toEqual(expectedUploaded);
  });

  test('#addRelationships should call uploader enqueue on flushed', async () => {
    const uploadCollector = createInMemoryStepGraphObjectDataUploaderCollector();
    const jobState = createTestStepJobState({
      graphObjectStore: new FileSystemGraphObjectStore({
        graphObjectBufferThreshold: 2,
      }),
      uploader: uploadCollector.uploader,
    });

    const r1 = createTestRelationship();
    const r2 = createTestRelationship();

    await jobState.addRelationships([r1]);
    await jobState.addRelationships([r2]);

    const expectedUploaded: FlushedGraphObjectData[] = [
      {
        entities: [],
        relationships: [r1, r2],
      },
    ];

    expect(uploadCollector.graphObjectDataCollection).toEqual(expectedUploaded);
  });

  test('#flush should call uploader enqueue for entities and relationships', async () => {
    const uploadCollector = createInMemoryStepGraphObjectDataUploaderCollector();
    const jobState = createTestStepJobState({
      graphObjectStore: new FileSystemGraphObjectStore({
        graphObjectBufferThreshold: 5,
      }),
      uploader: uploadCollector.uploader,
    });

    const r1 = createTestRelationship();
    const e1 = createTestEntity();

    await jobState.addRelationships([r1]);
    await jobState.addEntities([e1]);
    await jobState.flush();

    const expectedUploaded: FlushedGraphObjectData[] = [
      {
        entities: [e1],
        relationships: [],
      },
      {
        entities: [],
        relationships: [r1],
      },
    ];

    expect(uploadCollector.graphObjectDataCollection).toEqual(expectedUploaded);
  });

  test('#waitUntilUploadsComplete should resolve when all uploads completed', async () => {
    const graphObjectDataCollection: FlushedGraphObjectData[] = [];

    const uploader = createQueuedStepGraphObjectDataUploader({
      stepId: uuid(),
      uploadConcurrency: 5,
      async upload(graphObjectData) {
        await sleep(200);
        graphObjectDataCollection.push(graphObjectData);
        return Promise.resolve();
      },
    });

    const jobState = createTestStepJobState({
      graphObjectStore: new FileSystemGraphObjectStore({
        graphObjectBufferThreshold: 2,
      }),
      uploader,
    });

    const e1 = createTestEntity();
    const e2 = createTestEntity();

    await jobState.addEntities([e1]);
    await jobState.addEntities([e2]);

    if (!jobState.waitUntilUploadsComplete) {
      throw new Error(
        'Default job state should have "waitUntilUploadsComplete" function',
      );
    }

    await jobState.waitUntilUploadsComplete();

    const expectedUploaded: FlushedGraphObjectData[] = [
      {
        entities: [e1, e2],
        relationships: [],
      },
    ];

    expect(graphObjectDataCollection).toEqual(expectedUploaded);
  });
});
