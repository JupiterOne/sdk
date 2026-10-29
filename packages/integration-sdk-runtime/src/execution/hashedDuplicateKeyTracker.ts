import {
  IntegrationDuplicateKeyError,
  KeyNormalizationFunction,
} from '@jupiterone/integration-sdk-core';
import { DuplicateKeyTracker } from './duplicateKeyTracker';

const WORDS_PER_SLOT = 4;
const DEFAULT_INITIAL_CAPACITY = 1 << 16;
const MAX_LOAD_FACTOR = 0.7;

/**
 * Tracks a 128-bit MurmurHash3 fingerprint of each normalized key instead of the key itself, using ~16 bytes per key
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
    murmurHash3x86128(normalizedKey, this.fingerprint);
    // An all-zero first word marks an empty slot, so the lowest bit is always set.
    this.fingerprint[0] |= 1;
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

const MURMUR_C1 = 0x239b961b;
const MURMUR_C2 = 0xab0e9789;
const MURMUR_C3 = 0x38b34ae5;
const MURMUR_C4 = 0xa1e38b93;

/**
 * MurmurHash3 x86_128 (seed 0) of the key's UTF-16LE encoding, written into `out` as four 32-bit words.
 * Reads code units directly so it allocates nothing and does not cross into native code.
 */
export function murmurHash3x86128(key: string, out: Uint32Array): void {
  const length = key.length;
  const blockEnd = length - (length % 8);
  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  let h4 = 0;
  let i = 0;

  for (; i < blockEnd; i += 8) {
    h1 ^= mixK1(readWord(key, i, length));
    h1 = (Math.imul(rotl(h1, 19) + h2, 5) + 0x561ccd1b) | 0;
    h2 ^= mixK2(readWord(key, i + 2, length));
    h2 = (Math.imul(rotl(h2, 17) + h3, 5) + 0x0bcaa747) | 0;
    h3 ^= mixK3(readWord(key, i + 4, length));
    h3 = (Math.imul(rotl(h3, 15) + h4, 5) + 0x96cd1c35) | 0;
    h4 ^= mixK4(readWord(key, i + 6, length));
    h4 = (Math.imul(rotl(h4, 13) + h1, 5) + 0x32ac3b17) | 0;
  }

  const remaining = length - i;
  if (remaining > 6) h4 ^= mixK4(readWord(key, i + 6, length));
  if (remaining > 4) h3 ^= mixK3(readWord(key, i + 4, length));
  if (remaining > 2) h2 ^= mixK2(readWord(key, i + 2, length));
  if (remaining > 0) h1 ^= mixK1(readWord(key, i, length));

  const byteLength = length * 2;
  h1 ^= byteLength;
  h2 ^= byteLength;
  h3 ^= byteLength;
  h4 ^= byteLength;

  h1 = (h1 + h2 + h3 + h4) | 0;
  h2 = (h2 + h1) | 0;
  h3 = (h3 + h1) | 0;
  h4 = (h4 + h1) | 0;

  h1 = fmix(h1);
  h2 = fmix(h2);
  h3 = fmix(h3);
  h4 = fmix(h4);

  h1 = (h1 + h2 + h3 + h4) | 0;
  out[0] = h1;
  out[1] = h2 + h1;
  out[2] = h3 + h1;
  out[3] = h4 + h1;
}

function readWord(key: string, index: number, length: number) {
  return index + 1 < length
    ? key.charCodeAt(index) | (key.charCodeAt(index + 1) << 16)
    : key.charCodeAt(index);
}

function mixK1(k: number) {
  return Math.imul(rotl(Math.imul(k, MURMUR_C1), 15), MURMUR_C2);
}

function mixK2(k: number) {
  return Math.imul(rotl(Math.imul(k, MURMUR_C2), 16), MURMUR_C3);
}

function mixK3(k: number) {
  return Math.imul(rotl(Math.imul(k, MURMUR_C3), 17), MURMUR_C4);
}

function mixK4(k: number) {
  return Math.imul(rotl(Math.imul(k, MURMUR_C4), 18), MURMUR_C1);
}

function rotl(x: number, r: number) {
  return (x << r) | (x >>> (32 - r));
}

function fmix(h: number) {
  let x = h ^ (h >>> 16);
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return x ^ (x >>> 16);
}
