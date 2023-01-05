import {
  Entity,
  GraphObjectStore,
  IntegrationDuplicateKeyError,
  KeyNormalizationFunction,
} from '@jupiterone/integration-sdk-core';
import { deepStrictEqual } from 'assert';
import { BigMap } from './utils/bigMap';

export interface DuplicateKeyTrackerGraphObjectMetadata {
  _type: string;
  _key: string;
}

const DUPLICATE_KEY_TRACKER_DEFAULT_MAP_KEY_SPACE = 2000000;

/**
 * Contains a map of every graph object key to a specific set of metadata about
 * the graph object used for filtering. For example, we use the `_type` property
 * on graph objects as a method of filtering data down when iterating entities
 * or relationships. We store the `_type` inside the metadata for a fast lookup
 * table.
 */
export class DuplicateKeyTracker {
  private readonly graphObjectKeyMap: BigMap<
    string,
    DuplicateKeyTrackerGraphObjectMetadata
  >;
  private readonly normalizationFunction: KeyNormalizationFunction;

  constructor(normalizationFunction?: KeyNormalizationFunction) {
    this.normalizationFunction = normalizationFunction || ((_key) => _key);

    this.graphObjectKeyMap = new BigMap<
      string,
      DuplicateKeyTrackerGraphObjectMetadata
    >(DUPLICATE_KEY_TRACKER_DEFAULT_MAP_KEY_SPACE);
  }

  registerKey(_key: string, metadata: DuplicateKeyTrackerGraphObjectMetadata) {
    const normalizedKey = this.normalizationFunction(_key);
    if (this.graphObjectKeyMap.has(normalizedKey)) {
      throw new IntegrationDuplicateKeyError(
        `Duplicate _key detected (_key=${_key})`,
      );
    }

    this.graphObjectKeyMap.set(normalizedKey, metadata);
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

type DuplicateEntityReport = {
  _key: string;
  rawDataMatch: boolean;
  propertiesMatch: boolean;
};

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
  aClone._rawData = undefined;
  bClone._rawData = undefined;

  return {
    _key: a._key,
    rawDataMatch: isDeepStrictEqual(a._rawData, b._rawData),
    propertiesMatch: isDeepStrictEqual(aClone, bClone),
  };
}
