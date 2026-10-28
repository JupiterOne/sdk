import { createHash } from 'crypto';
import {
  IntegrationDuplicateKeyError,
  KeyNormalizationFunction,
} from '@jupiterone/integration-sdk-core';
import { DuplicateKeyTracker } from './duplicateKeyTracker';

const WORDS_PER_SLOT = 4;
const DEFAULT_INITIAL_CAPACITY = 1 << 16;
const MAX_LOAD_FACTOR = 0.7;

/**
 * Tracks a 128-bit md5 fingerprint of each normalized key instead of the key itself, using ~16 bytes per key
 * in an open-addressing table. Keys cannot be listed back, so `getEncounteredKeys` is unsupported.
 */
export class HashedDuplicateKeyTracker implements DuplicateKeyTracker {
  private readonly normalizationFunction: KeyNormalizationFunction;
  private readonly originalKeys = new Map<string, string>();
  private readonly fingerprint = new Uint32Array(WORDS_PER_SLOT);
  private capacity: number;
  private slots: Uint32Array;
  private size = 0;

  constructor(params?: {
    normalizationFunction?: KeyNormalizationFunction;
    initialCapacity?: number;
  }) {
    this.normalizationFunction =
      params?.normalizationFunction || ((_key) => _key);
    this.capacity = nextPowerOfTwo(
      params?.initialCapacity ?? DEFAULT_INITIAL_CAPACITY,
    );
    this.slots = new Uint32Array(this.capacity * WORDS_PER_SLOT);
  }

  getEncounteredKeys(): string[][] {
    throw new Error(
      'HashedDuplicateKeyTracker stores key fingerprints and cannot list encountered keys',
    );
  }

  registerKey(_key: string) {
    if ((this.size + 1) / this.capacity > MAX_LOAD_FACTOR) {
      this.grow();
    }

    const normalizedKey = this.normalizationFunction(_key);
    this.computeFingerprint(normalizedKey);

    const offset = this.findOffset();
    if (this.slots[offset] !== 0) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${_key})`,
      );
    }

    this.slots.set(this.fingerprint, offset);
    this.size++;

    if (normalizedKey !== _key) {
      this.originalKeys.set(normalizedKey, _key);
    }
  }

  getGraphObjectMetadata(_key: string): string | undefined {
    const normalizedKey = this.normalizationFunction(_key);
    if (!this.contains(normalizedKey)) {
      return undefined;
    }
    return this.originalKeys.get(normalizedKey) ?? normalizedKey;
  }

  hasKey(_key: string) {
    return this.contains(this.normalizationFunction(_key));
  }

  private contains(normalizedKey: string) {
    this.computeFingerprint(normalizedKey);
    return this.slots[this.findOffset()] !== 0;
  }

  private computeFingerprint(normalizedKey: string) {
    const digest = createHash('md5').update(normalizedKey).digest();
    // An all-zero first word marks an empty slot, so the lowest bit is always set.
    this.fingerprint[0] = digest.readUInt32LE(0) | 1;
    this.fingerprint[1] = digest.readUInt32LE(4);
    this.fingerprint[2] = digest.readUInt32LE(8);
    this.fingerprint[3] = digest.readUInt32LE(12);
  }

  /**
   * Returns the offset of the slot holding the current fingerprint, or of the empty slot where it belongs.
   */
  private findOffset() {
    const mask = this.capacity - 1;
    const [a, b, c, d] = this.fingerprint;
    let index = b & mask;

    for (;;) {
      const offset = index * WORDS_PER_SLOT;
      const first = this.slots[offset];
      if (
        first === 0 ||
        (first === a &&
          this.slots[offset + 1] === b &&
          this.slots[offset + 2] === c &&
          this.slots[offset + 3] === d)
      ) {
        return offset;
      }
      index = (index + 1) & mask;
    }
  }

  private grow() {
    const previous = this.slots;
    this.capacity *= 2;
    this.slots = new Uint32Array(this.capacity * WORDS_PER_SLOT);

    for (let offset = 0; offset < previous.length; offset += WORDS_PER_SLOT) {
      if (previous[offset] !== 0) {
        this.fingerprint.set(
          previous.subarray(offset, offset + WORDS_PER_SLOT),
        );
        this.slots.set(this.fingerprint, this.findOffset());
      }
    }
  }
}

function nextPowerOfTwo(value: number) {
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
}
