import {
  InMemoryDuplicateKeyTracker,
  createDuplicateEntityReport,
  diffObjects,
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
      propertiesDiff: JSON.stringify({
        _class: { type: 'value_mismatch' },
        _type: { type: 'value_mismatch' },
      }),
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
      rawDataDiff: JSON.stringify({
        data: { type: 'missing_in_src' },
      }),
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
      rawDataDiff: JSON.stringify({
        data: { type: 'missing_in_src' },
      }),
    });
  });
});

describe('diffObjects', () => {
  test('returns an empty diff for identical objects', () => {
    const src = { name: 'Alice', age: 30 };
    const dest = { name: 'Alice', age: 30 };

    expect(diffObjects(src, dest)).toEqual({});
  });

  test('detects missing keys in src', () => {
    const src = { name: 'Alice' };
    const dest = { name: 'Alice', age: 30 };

    expect(diffObjects(src, dest)).toEqual({
      age: { type: 'missing_in_src' },
    });
  });

  test('detects missing keys in dest', () => {
    const src = { name: 'Alice', age: 30 };
    const dest = { name: 'Alice' };

    expect(diffObjects(src, dest)).toEqual({
      age: { type: 'missing_in_dest' },
    });
  });

  test('detects type mismatches', () => {
    const src = { age: 30 };
    const dest = { age: '30' };

    expect(diffObjects(src, dest)).toEqual({
      age: {
        type: 'type_mismatch',
        valueTypes: { src: 'number', dest: 'string' },
      },
    });
  });

  test('detects value mismatches', () => {
    const src = { age: 30 };
    const dest = { age: 31 };

    expect(diffObjects(src, dest)).toEqual({
      age: { type: 'value_mismatch' },
    });
  });

  test('handles nested object differences', () => {
    const src = { user: { name: 'Alice', age: 30 } };
    const dest = { user: { name: 'Alice', age: 31 } };

    expect(diffObjects(src, dest)).toEqual({
      'user.age': { type: 'value_mismatch' },
    });
  });

  test('handles missing nested keys in src', () => {
    const src = { user: { name: 'Alice' } };
    const dest = { user: { name: 'Alice', age: 30 } };

    expect(diffObjects(src, dest)).toEqual({
      'user.age': { type: 'missing_in_src' },
    });
  });

  test('handles missing nested keys in dest', () => {
    const src = { user: { name: 'Alice', age: 30 } };
    const dest = { user: { name: 'Alice' } };

    expect(diffObjects(src, dest)).toEqual({
      'user.age': { type: 'missing_in_dest' },
    });
  });

  test('handles array comparison', () => {
    const src = { tags: ['a', 'b', 'c'], other: ['a', 'b', 'c'] };
    const dest = { tags: ['a', 'b', 'd'], other: ['a', 'b', 'c'] };

    expect(diffObjects(src, dest)).toEqual({
      tags: {
        type: 'value_mismatch',
      },
    });
  });

  test('handles empty objects', () => {
    const src = {};
    const dest = {};

    expect(diffObjects(src, dest)).toEqual({});
  });

  test('handles null and undefined objects', () => {
    expect(diffObjects(null, undefined)).toEqual({});
    expect(diffObjects(undefined, {})).toEqual({});
    expect(diffObjects({}, null)).toEqual({});
  });
});
