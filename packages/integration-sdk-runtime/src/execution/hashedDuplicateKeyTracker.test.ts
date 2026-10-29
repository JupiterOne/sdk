import { IntegrationDuplicateKeyError } from '@jupiterone/integration-sdk-core';
import {
  HashedDuplicateKeyTracker,
  murmurHash3x86128,
} from './hashedDuplicateKeyTracker';

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

describe('murmurHash3x86128', () => {
  test.each([
    ['', [0x0, 0x0, 0x0, 0x0]],
    ['abc', [0x2b5b97a3, 0x20f75fb5, 0x5012c2b4, 0x5012c2b4]],
    ['abcdefghi', [0x17a3d732, 0x37eee486, 0x04d39ee1, 0xee7f6ddc]],
    ['\u0100', [0x8acbc432, 0xdbd5d393, 0xdbd5d393, 0xdbd5d393]],
    ['\u{1f600}x', [0x15cd3d3b, 0x55e63efa, 0x54673d99, 0x54673d99]],
    [
      'arn:aws:ec2:us-east-1:123456789012:instance/i-0abc',
      [0x51ed1e9c, 0x526e20cd, 0x41bdf96c, 0x3b18facc],
    ],
  ])(
    'matches the reference digest of the UTF-16LE bytes of %j',
    (key, expected) => {
      const out = new Uint32Array(4);
      murmurHash3x86128(key, out);
      expect(Array.from(out)).toEqual(expected);
    },
  );

  test('distinguishes code units that differ only in their high byte', () => {
    const a = new Uint32Array(4);
    const b = new Uint32Array(4);
    murmurHash3x86128('\u0100', a);
    murmurHash3x86128('\u0000', b);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});
