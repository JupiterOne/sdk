import {
  Entity,
  GraphObjectStore,
  IntegrationDuplicateKeyError,
  KeyNormalizationFunction,
} from '@jupiterone/integration-sdk-core';
import { deepStrictEqual } from 'assert';
import { BigMap } from './utils/bigMap';

const DUPLICATE_KEY_TRACKER_DEFAULT_MAP_KEY_SPACE = 2_000_000;

export interface DuplicateKeyTracker {
  getEncounteredKeys(): string[][];
  registerKey(_key: string): void;
  getGraphObjectMetadata(_key: string): string | undefined;
  hasKey(_key: string): boolean;
}

/**
 * Contains a map of every graph object key to a specific set of metadata about
 * the graph object used for filtering. For example, we use the `_type` property
 * on graph objects as a method of filtering data down when iterating entities
 * or relationships. We store the `_type` inside the metadata for a fast lookup
 * table.
 */
export class InMemoryDuplicateKeyTracker implements DuplicateKeyTracker {
  private readonly graphObjectKeyMap: BigMap<string, string>;
  private readonly normalizationFunction: KeyNormalizationFunction;

  constructor(normalizationFunction?: KeyNormalizationFunction) {
    this.normalizationFunction = normalizationFunction || ((_key) => _key);

    this.graphObjectKeyMap = new BigMap<string, string>(
      DUPLICATE_KEY_TRACKER_DEFAULT_MAP_KEY_SPACE,
    );
  }

  getEncounteredKeys() {
    return this.graphObjectKeyMap.keys();
  }

  registerKey(_key: string) {
    const normalizedKey = this.normalizationFunction(_key);
    if (this.graphObjectKeyMap.has(normalizedKey)) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${_key})`,
      );
    }

    this.graphObjectKeyMap.set(normalizedKey, _key);
  }

  getGraphObjectMetadata(_key: string) {
    return this.graphObjectKeyMap.get(this.normalizationFunction(_key));
  }

  hasKey(_key: string) {
    return this.graphObjectKeyMap.has(this.normalizationFunction(_key));
  }
}

type DuplicateKeyReportParams = {
  duplicateEntity: Entity;
  payload: Entity[];
  indexOfDuplicateKey: number;
  graphObjectStore: GraphObjectStore;
};

export async function createDuplicateEntityReport({
  duplicateEntity,
  payload,
  indexOfDuplicateKey,
  graphObjectStore,
}: DuplicateKeyReportParams): Promise<DuplicateEntityReport> {
  const originalEntityFromPayload = getOriginalEntityFromPayload(
    payload,
    duplicateEntity._key,
    indexOfDuplicateKey,
  );

  if (originalEntityFromPayload) {
    return compareEntities(originalEntityFromPayload, duplicateEntity);
  } else {
    const originalEntityFromGraphObjectStore =
      await graphObjectStore.findEntity(duplicateEntity._key);
    return compareEntities(
      originalEntityFromGraphObjectStore!,
      duplicateEntity,
    );
  }
}

/**
 * Determines if the original entity that is duplicated by the new entity with the same key
 * is inside the payload or in the graphObjectStore.
 *
 * @param payload the payload a duplicate _key was found in
 * @param _key the _key that is a duplicate
 * @param duplicateFoundIndex the index of the Entity or Relationship that triggered the DUPLICATE_KEY_ERROR
 * @returns the original entity or relationship if it is inside the payload, otherwise returns undefined
 */
function getOriginalEntityFromPayload(
  payload: Entity[],
  _key: string,
  duplicateFoundIndex: number,
): Entity | undefined {
  return payload.find((v, i) => {
    if (i >= duplicateFoundIndex) {
      return undefined;
    } else if (v._key === _key) {
      return v;
    }
  });
}

/**
 * isDeepStrictEqual deeply compares two values and returns true if they are equal
 * @param a any
 * @param b any
 * @returns boolean representing if the two values are deeply equal
 */
function isDeepStrictEqual(a: any, b: any): boolean {
  try {
    deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

export type DuplicateEntityReport = {
  _key: string;
  rawDataMatch: boolean;
  propertiesMatch: boolean;
  rawDataDiff?: string;
  propertiesDiff?: string;
};

type DiffType =
  | 'missing_in_src'
  | 'missing_in_dest'
  | 'type_mismatch'
  | 'value_mismatch';

interface ObjectDiff {
  [key: string]: {
    type: DiffType;
    valueTypes?: { src: string; dest: string };
  };
}

/**
 * Compares two objects and returns the differences between them.
 *
 * @param {unknown} src - The source object to compare.
 * @param {unknown} dest - The destination object to compare.
 * @param {string} [path=''] - The base path for keys, used for tracking nested object differences.
 * @returns {ObjectDiff} An object representing the differences between `src` and `dest`.
 *   Each key corresponds to a path in the objects, with details about the type of difference.
 *
 * @example
 * const src = { a: 1, b: { c: 2 } };
 * const dest = { a: 1, b: { c: 3 }, d: 4 };
 * const result = diffObjects(src, dest);
 * console.log(result);
 * // Output:
 * // {
 * //   "b.c": { type: "value_mismatch" },
 * //   "d": { type: "missing_in_src" }
 * // }
 */
export function diffObjects(
  src: unknown,
  dest: unknown,
  path: string = '',
): ObjectDiff {
  const diff = {};

  // Helper to add differences
  const addDiff = (
    key: string,
    type: DiffType,
    valueTypes?: { src: string; dest: string },
  ) => {
    diff[key] = { type, valueTypes };
  };

  // Iterate through the keys of both objects
  const allKeys = new Set([
    ...Object.keys(src || {}),
    ...Object.keys(dest || {}),
  ]);

  const isObject = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null;

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    const valSrc = src?.[key];
    const valDest = dest?.[key];

    if (valSrc === undefined) {
      addDiff(fullPath, 'missing_in_src');
    } else if (valDest === undefined) {
      addDiff(fullPath, 'missing_in_dest');
    } else if (typeof valSrc !== typeof valDest) {
      addDiff(fullPath, 'type_mismatch', {
        src: typeof valSrc,
        dest: typeof valDest,
      });
    } else if (Array.isArray(valSrc) && Array.isArray(valDest)) {
      if (JSON.stringify(valSrc) !== JSON.stringify(valDest)) {
        addDiff(fullPath, 'value_mismatch');
      }
    } else if (isObject(valSrc) && isObject(valDest)) {
      // Recursive comparison for nested objects
      const nestedDiff = diffObjects(valSrc, valDest, fullPath);
      Object.assign(diff, nestedDiff);
    } else if (valSrc !== valDest) {
      addDiff(fullPath, 'value_mismatch');
    }
  }

  return diff;
}

/**
 * compareEntities compares two entities and produces a DuplicateEntityReport describing their
 * similarities and differences.
 * @param a
 * @param b
 * @returns
 */
function compareEntities(a: Entity, b: Entity): DuplicateEntityReport {
  const aClone = JSON.parse(JSON.stringify(a));
  const bClone = JSON.parse(JSON.stringify(b));
  delete aClone._rawData;
  delete bClone._rawData;

  const rawDataMatch = isDeepStrictEqual(a._rawData, b._rawData);
  const propertiesMatch = isDeepStrictEqual(aClone, bClone);

  let rawDataDiff: ObjectDiff | undefined;
  if (!rawDataMatch) {
    try {
      rawDataDiff = diffObjects(
        a._rawData?.[0].rawData,
        b._rawData?.[0].rawData,
      );
    } catch (e) {
      // ignore
    }
  }

  let propertiesDiff: ObjectDiff | undefined;
  if (!propertiesMatch) {
    try {
      propertiesDiff = diffObjects(aClone, bClone);
    } catch (e) {
      // ignore
    }
  }

  return {
    _key: a._key,
    rawDataMatch,
    propertiesMatch,
    ...(rawDataDiff && { rawDataDiff: JSON.stringify(rawDataDiff) }),
    ...(propertiesDiff && { propertiesDiff: JSON.stringify(propertiesDiff) }),
  };
}
