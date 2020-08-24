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
import {
  Entity,
  IntegrationMissingKeyError,
} from '@jupiterone/integration-sdk-core';

jest.mock('fs');

function getMockCreateStepJobStateParams(): CreateStepJobStateParams {
  return {
    stepId: uuid(),
    graphObjectStore: new FileSystemGraphObjectStore(),
    duplicateKeyTracker: new DuplicateKeyTracker(),
    typeTracker: new TypeTracker(),
    dataStore: new MemoryDataStore(),
  };
}

describe('#createStepJobState', () => {
  afterEach(() => {
    vol.reset();
  });

  test('should allow creating job state and adding a single entity with "addEntity"', async () => {
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);
    const entity: Entity = {
      _type: 'a_entity',
      _class: 'A',
      _key: 'a',
    };

    const result = await jobState.addEntity(entity);
    expect(result).toBe(entity);
  });

  test('should allow creating job state and adding a multiple entities with "addEntities"', async () => {
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);
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
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);
    const entity: Entity = {
      _type: 'a_entity',
      _class: 'A',
      _key: 'a',
    };

    await jobState.addEntity(entity);
    expect(await jobState.findEntity('a')).toStrictEqual(entity);
  });

  test('should return "null" if entity not found', async () => {
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);
    expect(await jobState.findEntity('invalid-entity-key')).toEqual(null);
  });
});
