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
  const chunkedData: T[K][][] = [];
  if (getSizeOfObject(data) < sizeInBytes) {
    return [data]; //Just one chunk of all data
  }
  let bestIndex = binarySearch(data, sizeInBytes);
  if (bestIndex <= 0) {
    //If the first entity is too big
    handleBinarySearchError(data, sizeInBytes, logger); // we remove rawdata
    bestIndex = 1; //and send it to the persister alone. TODO: find a way to avoid sending this entities as a single call. It shouldn't be an issue since this only happens if there is a signle entity above sizeInBytes
  }
  chunkedData.push(data.slice(0, bestIndex));
  if (bestIndex !== data.length)
    chunkedData.push(
      ...chunk(data.slice(bestIndex), sizeInBytes, logger), //chunk the rest of the data
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
  let bestIndex: number = -1;
  const thSize = targetSize * BATCH_THRESHOLD;
  let mid: number = Math.floor((left + right) / 2);
  let size = getSizeOfObject(data.slice(0, mid));
  while (left <= right) {
    if (size <= targetSize) {
      bestIndex = mid;
      if (size >= thSize) {
        return mid; //if its **close enough** to the target size
      }
    }
    if (targetSize < size) {
      right = mid - 1;
      if (left <= right) {
        const newMid = Math.floor((left + right) / 2);
        size = size - getSizeOfObject(data.slice(newMid, mid));
        mid = newMid;
      }
    } else {
      left = mid + 1;
      if (left <= right) {
        const newMid = Math.floor((left + right) / 2);
        size = size + getSizeOfObject(data.slice(mid, newMid));
        mid = newMid;
      }
    }
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
      //If object is too large to size, stringify runs out of memory. We fallback to the max batchSize.
      return MAX_BATCH_SIZE;
    }
    throw error;
  }
}
