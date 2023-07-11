import {
  Entity,
  IntegrationLogger,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { UploadDataLookup } from '.';
import { MAX_BATCH_SIZE } from './shrinkBatchRawData';
const BATCH_THRESHOLD = 0.9; //will stop chunking if chunk size is between BATCH_THRESHOLD*sizeInBytes and sizeInBytes

export function chunkBySize<T extends UploadDataLookup, K extends keyof T>(
  data: T[K][],
  sizeInBytes: number,
  logger: IntegrationLogger,
): T[K][][] {
  if (sizeInBytes > MAX_BATCH_SIZE) {
    logger.error({}, 'batch size is too big');
    throw Error();
  }
  return chunk(data, sizeInBytes, logger);
}
export function chunk<T extends UploadDataLookup, K extends keyof T>(
  data: T[K][],
  sizeInBytes: number,
  logger: IntegrationLogger,
): T[K][][] {
  let chunkedData: T[K][][] = [];
  if (getSizeOfObject(data) < sizeInBytes) {
    return [data]; //Just one chunk of all data
  }
  let bestIndex = binarySearch(data, sizeInBytes);
  if (bestIndex <= 0) {
    handleBinarySearchError(data, sizeInBytes, logger);
    bestIndex = 1;
  }
  chunkedData.push(data.slice(0, bestIndex));
  if (bestIndex !== data.length)
    chunkedData = chunkedData.concat(
      chunk(data.slice(bestIndex), sizeInBytes, logger),
    );
  return chunkedData;
}
//If the batch doesnt fit, we try with half, and then half of half ... until it fits.
//We repeat until we reach the Threshold or until the while condition.
function binarySearch<T extends UploadDataLookup, K extends keyof T>(
  data: T[K][],
  targetSize: number,
): number {
  let left: number = 0;
  let right: number = data.length - 1;
  let bestIndex = -1;
  while (left <= right) {
    const mid: number = Math.floor((left + right) / 2);
    const size = getSizeOfObject(data.slice(0, right));
    if (size <= targetSize) {
      bestIndex = mid;
      if (size >= targetSize * BATCH_THRESHOLD) {
        return mid;
      }
    }
    if (targetSize < size) right = mid - 1;
    else left = mid + 1;
  }
  return bestIndex;
}
function handleBinarySearchError<T extends UploadDataLookup, K extends keyof T>(
  data: T[K][],
  sizeInBytes: number,
  logger: IntegrationLogger,
) {
  const bigBatch = data.slice(0, 1) as Entity[] | Relationship[];
  if (bigBatch[0] && bigBatch[0]._rawData) {
    logger.info(
      bigBatch[0].key,
      'Entity/Relationship is too big to ingest. Will remove _rawData',
    );
    bigBatch[0]._rawData = [];
  }
  if (getSizeOfObject(bigBatch) > sizeInBytes) {
    logger.error(
      bigBatch[0].key,
      'Entity/Relationship is too big to ingest. This usually happens when item has a lot of long attributes.',
    );
    throw Error();
  }
}
export function getSizeOfObject<T extends UploadDataLookup, K extends keyof T>(
  object: T[K][],
): number {
  try {
    return JSON.stringify(object).length;
  } catch (error) {
    if (error instanceof RangeError) {
      //If object is too large to size we fallback to the max batchSize
      return MAX_BATCH_SIZE;
    }
    throw error;
  }
}
