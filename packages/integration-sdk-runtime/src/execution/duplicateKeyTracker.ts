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
  entityPropertiesMatch: boolean;
  rawDataDiff?: string;
  entityPropertiesDiff?: string;
};

type DiffType =
  | 'missing_in_original'
  | 'missing_in_duplicate'
  | 'type_mismatch'
  | 'value_mismatch'
  | 'array_values_mismatch';

interface ObjectDiff {
  [key: string]: {
    type: DiffType;
    valueTypes?: { src: string; dest: string };
  };
}

/**
 * Compares two objects and returns the differences between them.
 *
 * @param {unknown} originalObject - The source object to compare.
 * @param {unknown} duplicateObject - The destination object to compare.
 * @param {string} [path=''] - The base path for keys, used for tracking nested object differences.
 * @returns {ObjectDiff} An object representing the differences between `original` and `duplicate`.
 *   Each key corresponds to a path in the objects, with details about the type of difference.
 *
 * @example
 * const originalObj = { a: 1, b: { c: 2 } };
 * const duplicateObj = { a: 1, b: { c: 3 }, d: 4 };
 * const result = diffObjects(originalObj, duplicateObj);
 * console.log(result);
 * // Output:
 * // {
 * //   "b.c": { type: "value_mismatch" },
 * //   "d": { type: "missing_in_original" }
 * // }
 */
export function diffObjects(
  originalObject: unknown,
  duplicateObject: unknown,
  path: string = '',
): ObjectDiff {
  const diff = {};

  // Helper to add differences
  const addDiff = (
    key: string,
    diffType: DiffType,
    valueTypes?: { original: string; duplicate: string },
  ) => {
    diff[key] = { diffType, valueTypes };
  };

  // Iterate through the keys of both objects
  const allKeys = new Set([
    ...Object.keys(originalObject || {}),
    ...Object.keys(duplicateObject || {}),
  ]);

  const isObject = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null;

  for (const key of allKeys) {
    const fullPath = path ? `${path}.${key}` : key;
    const valOriginal = originalObject?.[key];
    const valDuplicate = duplicateObject?.[key];

    if (valOriginal === undefined) {
      addDiff(fullPath, 'missing_in_original');
    } else if (valDuplicate === undefined) {
      addDiff(fullPath, 'missing_in_duplicate');
    } else if (typeof valOriginal !== typeof valDuplicate) {
      addDiff(fullPath, 'type_mismatch', {
        original: typeof valOriginal,
        duplicate: typeof valDuplicate,
      });
    } else if (Array.isArray(valOriginal) && Array.isArray(valDuplicate)) {
      if (JSON.stringify(valOriginal) !== JSON.stringify(valDuplicate)) {
        addDiff(fullPath, 'array_values_mismatch');
      }
    } else if (isObject(valOriginal) && isObject(valDuplicate)) {
      // Recursive comparison for nested objects
      const nestedDiff = diffObjects(valOriginal, valDuplicate, fullPath);
      Object.assign(diff, nestedDiff);
    } else if (valOriginal !== valDuplicate) {
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
  const entityPropertiesMatch = isDeepStrictEqual(aClone, bClone);

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

  let entityPropertiesDiff: ObjectDiff | undefined;
  if (!entityPropertiesMatch) {
    try {
      entityPropertiesDiff = diffObjects(aClone, bClone);
    } catch (e) {
      // ignore
    }
  }

  return {
    _key: a._key,
    rawDataMatch,
    entityPropertiesMatch,
    ...(rawDataDiff && { rawDataDiff: JSON.stringify(rawDataDiff) }),
    ...(entityPropertiesDiff && {
      entityPropertiesDiff: JSON.stringify(entityPropertiesDiff),
    }),
  };
}
