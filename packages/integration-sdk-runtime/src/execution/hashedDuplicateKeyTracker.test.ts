import { IntegrationDuplicateKeyError } from '@jupiterone/integration-sdk-core';
import { HashedDuplicateKeyTracker } from './hashedDuplicateKeyTracker';

describe('HashedDuplicateKeyTracker', () => {
  test('has key returns true only for registered keys', () => {
    const tracker = new HashedDuplicateKeyTracker();
    tracker.registerKey('test-key-1');

    expect(tracker.hasKey('test-key-1')).toBeTrue();
    expect(tracker.hasKey('not-found')).toBeFalse();
  });

  test('throws a duplicate key error when a key is registered twice', () => {
    const tracker = new HashedDuplicateKeyTracker();
    tracker.registerKey('test-key-1');

    expect(() => tracker.registerKey('test-key-1')).toThrow(
      IntegrationDuplicateKeyError,
    );
  });

  test('keeps every key while the table grows', () => {
    const tracker = new HashedDuplicateKeyTracker({ initialCapacity: 16 });
    const keys = Array.from({ length: 50_000 }, (_, i) => `key-${i}`);
    keys.forEach((key) => tracker.registerKey(key));

    expect(keys.every((key) => tracker.hasKey(key))).toBeTrue();
    expect(keys.some((key) => tracker.hasKey(`${key}|has|${key}`))).toBeFalse();
    expect(() => tracker.registerKey('key-49999')).toThrow(
      IntegrationDuplicateKeyError,
    );
  });

  test('returns the registered key as metadata', () => {
    const tracker = new HashedDuplicateKeyTracker();
    tracker.registerKey('test-key-1');

    expect(tracker.getGraphObjectMetadata('test-key-1')).toEqual('test-key-1');
    expect(tracker.getGraphObjectMetadata('not-found')).toBeUndefined();
  });

  test('applies the normalization function and returns the original key', () => {
    const tracker = new HashedDuplicateKeyTracker({
      normalizationFunction: (_key) => _key.toLowerCase(),
    });
    tracker.registerKey('Test-Key-1');
    tracker.registerKey('test-key-2');

    expect(tracker.hasKey('TEST-KEY-1')).toBeTrue();
    expect(tracker.getGraphObjectMetadata('test-key-1')).toEqual('Test-Key-1');
    expect(tracker.getGraphObjectMetadata('TEST-KEY-2')).toEqual('test-key-2');
    expect(() => tracker.registerKey('test-key-1')).toThrow(
      IntegrationDuplicateKeyError,
    );
  });

  test('cannot list encountered keys', () => {
    const tracker = new HashedDuplicateKeyTracker();
    tracker.registerKey('test-key-1');

    expect(() => tracker.getEncounteredKeys()).toThrow(
      'HashedDuplicateKeyTracker stores key fingerprints and cannot list encountered keys',
    );
  });
});
