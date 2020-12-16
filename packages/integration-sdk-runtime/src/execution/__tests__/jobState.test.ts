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

jest.mock('fs');

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
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);
    expect(await jobState.findEntity('invalid-entity-key')).toEqual(null);
  });
});
