import {
  InMemoryDuplicateKeyTracker,
  createDuplicateEntityReport,
} from './duplicateKeyTracker';
import { InMemoryGraphObjectStore } from '../storage';
import { Entity } from '@jupiterone/integration-sdk-core';
describe('InMemoryDuplicateKeyTracker', () => {
  test('has key returns true when key is present', () => {
    const duplicateKeyTracker = new InMemoryDuplicateKeyTracker();
    const _key = 'test-key-1';
    duplicateKeyTracker.registerKey(_key);
    expect(duplicateKeyTracker.hasKey(_key)).toBeTrue();
  });

  test('has key returns false when key is not present', () => {
    const duplicateKeyTracker = new InMemoryDuplicateKeyTracker();
    const _key = 'test-key-1';
    duplicateKeyTracker.registerKey(_key);
    expect(duplicateKeyTracker.hasKey('not-found')).toBeFalse();
  });
});

describe('createDuplicateEntityReport', () => {
  test('should report full match on deeply equal entities', async () => {
    const originalEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      _rawData: [
        {
          name: 'default',
          rawData: {
            someData: 123,
            someMoreData: '123',
            nestedData: {
              nested: 'data',
            },
            arrayData: ['1', '2'],
          },
        },
      ],
    };

    const duplicateEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      _rawData: [
        {
          name: 'default',
          rawData: {
            someData: 123,
            someMoreData: '123',
            nestedData: {
              nested: 'data',
            },
            arrayData: ['1', '2'],
          },
        },
      ],
    };

    const payload = [originalEntity, duplicateEntity];
    const indexOfDuplicateKey = 1;
    const graphObjectStore = new InMemoryGraphObjectStore();

    const der = await createDuplicateEntityReport({
      payload,
      indexOfDuplicateKey,
      duplicateEntity,
      graphObjectStore,
    });

    expect(der).toMatchObject({
      _key: 'test-key',
      propertiesMatch: true,
      rawDataMatch: true,
    });
  });

  test('should report rawData match when only raw data matches', async () => {
    const originalEntity: Entity = {
      _key: 'test-key',
      _class: ['Host'],
      _type: 'laptop',
      _rawData: [
        {
          name: 'default',
          rawData: {
            someData: 123,
            someMoreData: '123',
            nestedData: {
              nested: 'data',
            },
            arrayData: ['1', '2'],
          },
        },
      ],
    };

    const duplicateEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      _rawData: [
        {
          name: 'default',
          rawData: {
            someData: 123,
            someMoreData: '123',
            nestedData: {
              nested: 'data',
            },
            arrayData: ['1', '2'],
          },
        },
      ],
    };

    const payload = [originalEntity, duplicateEntity];
    const indexOfDuplicateKey = 1;
    const graphObjectStore = new InMemoryGraphObjectStore();

    const der = await createDuplicateEntityReport({
      payload,
      indexOfDuplicateKey,
      duplicateEntity,
      graphObjectStore,
    });

    expect(der).toMatchObject({
      _key: 'test-key',
      propertiesMatch: false,
      rawDataMatch: true,
    });
  });

  test('should report properties match when only properties matches, not rawData', async () => {
    const originalEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      stringProperty: 'test-property-1',
      numberProperty: 1,
      booleanProperty: true,
      arrayProperty: [1, 2, 3],
      _rawData: [
        {
          name: 'default',
          rawData: {},
        },
      ],
    };

    const duplicateEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      stringProperty: 'test-property-1',
      numberProperty: 1,
      booleanProperty: true,
      arrayProperty: [1, 2, 3],
      _rawData: [
        {
          name: 'different-raw-data',
          rawData: {
            data: '1',
          },
        },
      ],
    };

    const payload = [originalEntity, duplicateEntity];
    const indexOfDuplicateKey = 1;
    const graphObjectStore = new InMemoryGraphObjectStore();

    const der = await createDuplicateEntityReport({
      payload,
      indexOfDuplicateKey,
      duplicateEntity,
      graphObjectStore,
    });

    expect(der).toMatchObject({
      _key: 'test-key',
      propertiesMatch: true,
      rawDataMatch: false,
    });
  });

  test('can find duplicate entity outside of payload', async () => {
    const graphObjectStore = new InMemoryGraphObjectStore();
    const originalEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      stringProperty: 'test-property-1',
      numberProperty: 1,
      booleanProperty: true,
      arrayProperty: [1, 2, 3],
      _rawData: [
        {
          name: 'default',
          rawData: {},
        },
      ],
    };

    // Add original entity to graphObjectStore
    await graphObjectStore.addEntities('test-step', [originalEntity]);

    const duplicateEntity: Entity = {
      _key: 'test-key',
      _class: ['Device'],
      _type: 'user_endpoint',
      stringProperty: 'test-property-1',
      numberProperty: 1,
      booleanProperty: true,
      arrayProperty: [1, 2, 3],
      _rawData: [
        {
          name: 'different-raw-data',
          rawData: {
            data: '1',
          },
        },
      ],
    };

    const payload = [duplicateEntity];
    const indexOfDuplicateKey = 0;

    const der = await createDuplicateEntityReport({
      duplicateEntity,
      indexOfDuplicateKey,
      graphObjectStore,
      payload,
    });

    expect(der).toMatchObject({
      _key: 'test-key',
      propertiesMatch: true,
      rawDataMatch: false,
    });
  });
});
