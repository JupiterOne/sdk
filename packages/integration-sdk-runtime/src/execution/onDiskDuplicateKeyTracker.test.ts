import { randomUUID } from 'crypto';
import { OnDiskDuplicateKeyTracker } from './onDiskDuplicateKeyTracker';
import { rm } from 'fs/promises';

describe('ondiskduplicatekeystore', () => {
  test('should persist to disk', async () => {
    const filepath = randomUUID();
    try {
      const map = new Map<string, string>();
      const keys = Array.from({ length: 520 }, () => Math.random().toString());
      const dt = new OnDiskDuplicateKeyTracker({
        filepath,
        internalBuffer: map,
        internalBufferSize: 500,
      });
      for (const key of keys) {
        await dt.registerKey(key);
        expect(dt.hasKey(key)).toBeTrue();
      }

      for (const key of keys) {
        expect(dt.hasKey(key)).toBeTrue();
      }

      expect(map.size).toBeLessThan(520);
    } finally {
      await rm(filepath, { recursive: true });
    }
  });

  test('should return false when does not have key', async () => {
    const filepath = randomUUID();
    try {
      const map = new Map<string, string>();
      const keys = Array.from({ length: 520 }, () => Math.random().toString());
      const dt = new OnDiskDuplicateKeyTracker({
        filepath,
        internalBuffer: map,
        internalBufferSize: 500,
      });
      for (const key of keys) {
        await dt.registerKey(key);
        expect(dt.hasKey(key)).toBeTrue();
      }

      for (const key of keys) {
        expect(dt.hasKey(key)).toBeTrue();
      }

      expect(dt.hasKey('not-real')).toBeFalse();
    } finally {
      await rm(filepath, { recursive: true });
    }
  });

  test('getEncounteredKeys returns all keys', async () => {
    const filepath = randomUUID();
    try {
      const keys = Array.from({ length: 10 }, () => Math.random().toString());

      // settint to lower than default to ensure we get some keys on disk
      const dt = new OnDiskDuplicateKeyTracker({
        filepath,
        internalBufferSize: 500,
      });

      for (const key of keys) {
        await dt.registerKey(key);
      }

      const keySet = new Set(keys);
      expect(keySet.size).toEqual(keys.length);
      const encounteredKeys = dt.getEncounteredKeys().at(0)!;
      encounteredKeys.map((key) => {
        expect(keySet.has(key)).toBeTrue();
      });
      expect(encounteredKeys.length).toEqual(keySet.size);
    } finally {
      await rm(filepath, { recursive: true });
    }
  });
});
