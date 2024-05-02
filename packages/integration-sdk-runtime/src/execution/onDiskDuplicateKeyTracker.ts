import { KeyNormalizationFunction } from '@jupiterone/integration-sdk-core';
import { open, RootDatabase } from 'lmdb';

const DEFAULT_IN_MEMORY_BUFFER_SIZE = 10_000;

/**
 * WARNING: Unstable, this class may make breaking changes in the future
 * with no warning while we work out it's usage and interface in integrations
 */
export class OnDiskDuplicateKeyTracker {
  private lmdb: RootDatabase;
  private readonly interalBuffer: Map<string, string>;
  private readonly internalBufferSize: number;
  private readonly normalizationFunction: KeyNormalizationFunction;

  constructor(params?: {
    filepath?: string;
    normalizationFunction?: KeyNormalizationFunction;
    internalBuffer?: Map<string, string>;
    internalBufferSize?: number;
  }) {
    this.normalizationFunction =
      params?.normalizationFunction || ((_key) => _key);
    this.lmdb = open(params?.filepath ?? 'key-tracker.db', {
      encoding: 'string',
    });
    this.interalBuffer = params?.internalBuffer ?? new Map<string, string>();
    this.internalBufferSize =
      params?.internalBufferSize ?? DEFAULT_IN_MEMORY_BUFFER_SIZE;
  }

  getGraphObjectMetadata(_key: string): string | undefined {
    return this.interalBuffer.get(_key) ?? this.lmdb.get(_key);
  }

  getEncounteredKeys(): string[][] {
    const keys: string[] = [];
    for (const key of this.lmdb.getKeys()) {
      keys.push(key as string);
    }
    for (const key of this.interalBuffer.keys()) {
      keys.push(key);
    }
    return [keys];
  }

  registerKey(_key: string) {
    const normalizedKey = this.normalizationFunction(_key);
    if (this.interalBuffer.has(normalizedKey) || this.lmdb.get(normalizedKey)) {
      throw new Error(`Duplicate _key detected (_key=${_key})`);
    }

    this.interalBuffer.set(normalizedKey, _key);

    if (this.interalBuffer.size > this.internalBufferSize) {
      const keys: string[] = [];
      this.lmdb.transactionSync(() => {
        for (const [key, value] of this.interalBuffer.entries()) {
          this.lmdb.put(key, value).catch((e) => {
            throw e;
          });
          keys.push(key);
        }
      });

      for (const key of keys) {
        this.interalBuffer.delete(key);
      }
    }
  }

  hasKey(_key: string) {
    const normalizedKey = this.normalizationFunction(_key);
    return (
      !!this.lmdb.get(normalizedKey) || this.interalBuffer.has(normalizedKey)
    );
  }
}
