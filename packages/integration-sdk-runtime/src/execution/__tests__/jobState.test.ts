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

describe('#getEntity', () => {
  afterEach(() => {
    vol.reset();
  });

  test('should get entity by _key', async () => {
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);
    const entity: Entity = {
      _type: 'a_entity',
      _class: 'A',
      _key: 'a',
    };

    await jobState.addEntity(entity);
    expect(await jobState.getEntity('a')).toStrictEqual(entity);
  });

  test('should throw if entity does not exist', async () => {
    expect.assertions(2);
    const params = getMockCreateStepJobStateParams();
    const jobState = createStepJobState(params);

    try {
      await jobState.getEntity('invalid-entity-key');
    } catch (err) {
      expect(err instanceof IntegrationMissingKeyError).toEqual(true);
      expect(err.message).toEqual(
        `Failed to find entity in in-memory graph object metadata store (_key=invalid-entity-key)`,
      );
    }
  });
});
