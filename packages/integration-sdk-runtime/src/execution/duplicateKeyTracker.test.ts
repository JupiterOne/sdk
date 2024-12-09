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
      entityPropertiesMatch: true,
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
      entityPropertiesMatch: false,
      rawDataMatch: true,
      entityPropertiesDiff: JSON.stringify({
        _class: { diffType: 'array_values_mismatch' },
        _type: { diffType: 'value_mismatch' },
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
      entityPropertiesMatch: true,
      rawDataMatch: false,
      rawDataDiff: JSON.stringify({
        data: { diffType: 'missing_in_original' },
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
      entityPropertiesMatch: true,
      rawDataMatch: false,
      rawDataDiff: JSON.stringify({
        data: { diffType: 'missing_in_original' },
      }),
    });
  });
});

describe('diffObjects', () => {
  test('returns an empty diff for identical objects', () => {
    const original = { name: 'Alice', age: 30 };
    const duplicate = { name: 'Alice', age: 30 };

    expect(diffObjects(original, duplicate)).toEqual({});
  });

  test('detects missing keys in original', () => {
    const original = { name: 'Alice' };
    const duplicate = { name: 'Alice', age: 30 };

    expect(diffObjects(original, duplicate)).toEqual({
      age: { diffType: 'missing_in_original' },
    });
  });

  test('detects missing keys in duplicate', () => {
    const original = { name: 'Alice', age: 30 };
    const duplicate = { name: 'Alice' };

    expect(diffObjects(original, duplicate)).toEqual({
      age: { diffType: 'missing_in_duplicate' },
    });
  });

  test('detects type mismatches', () => {
    const original = { age: 30 };
    const duplicate = { age: '30' };

    expect(diffObjects(original, duplicate)).toEqual({
      age: {
        diffType: 'type_mismatch',
        valueTypes: { original: 'number', duplicate: 'string' },
      },
    });
  });

  test('detects value mismatches', () => {
    const original = { age: 30 };
    const duplicate = { age: 31 };

    expect(diffObjects(original, duplicate)).toEqual({
      age: { diffType: 'value_mismatch' },
    });
  });

  test('handles nested object differences', () => {
    const original = { user: { name: 'Alice', age: 30 } };
    const duplicate = { user: { name: 'Alice', age: 31 } };

    expect(diffObjects(original, duplicate)).toEqual({
      'user.age': { diffType: 'value_mismatch' },
    });
  });

  test('handles missing nested keys in original', () => {
    const original = { user: { name: 'Alice' } };
    const duplicate = { user: { name: 'Alice', age: 30 } };

    expect(diffObjects(original, duplicate)).toEqual({
      'user.age': { diffType: 'missing_in_original' },
    });
  });

  test('handles missing nested keys in duplicate', () => {
    const original = { user: { name: 'Alice', age: 30 } };
    const duplicate = { user: { name: 'Alice' } };

    expect(diffObjects(original, duplicate)).toEqual({
      'user.age': { diffType: 'missing_in_duplicate' },
    });
  });

  test('handles array comparison', () => {
    const original = { tags: ['a', 'b', 'c'], other: ['a', 'b', 'c'] };
    const duplicate = { tags: ['a', 'b', 'd'], other: ['a', 'b', 'c'] };

    expect(diffObjects(original, duplicate)).toEqual({
      tags: {
        diffType: 'array_values_mismatch',
      },
    });
  });

  test('handles empty objects', () => {
    const original = {};
    const duplicate = {};

    expect(diffObjects(original, duplicate)).toEqual({});
  });

  test('handles null and undefined objects', () => {
    expect(diffObjects(null, undefined)).toEqual({});
    expect(diffObjects(undefined, {})).toEqual({});
    expect(diffObjects({}, null)).toEqual({});
  });
});
