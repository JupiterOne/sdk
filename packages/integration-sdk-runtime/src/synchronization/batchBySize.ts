import {
  Entity,
  IntegrationLogger,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { UploadDataLookup } from '.';
import { MAX_BATCH_SIZE_IN_BYTES } from './shrinkBatchRawData';
const BATCH_THRESHOLD = 0.9; //will stop chunking if chunk size is between BATCH_THRESHOLD*sizeInBytes and sizeInBytes

export function chunkBySize<T extends UploadDataLookup, K extends keyof T>(
  data: T[K][],
  sizeInBytes: number,
  logger: IntegrationLogger,
): T[K][][] {
  const chunkedData: T[K][][] = [];
  let bestIndex = linearSearch(data, sizeInBytes);
  if (bestIndex > 0 && bestIndex + 1 == data.length) {
    //Are we at the end of the array?
    chunkedData.push(data);
    return chunkedData;
  }
  if (bestIndex <= 0) {
    //If the first entity is too big
    handleSearchError(data, sizeInBytes, logger); // we remove rawdata
    bestIndex = 1; //and send it to the persister alone. TODO: find a way to avoid sending this entities as a single call. It shouldn't be an issue since this only happens if there is a single entity above sizeInBytes
  }
  chunkedData.push(data.slice(0, bestIndex));
  if (bestIndex !== data.length)
    chunkedData.push(
      ...chunkBySize(data.slice(bestIndex), sizeInBytes, logger), //chunk the rest of the data
    );
  return chunkedData;
}
/** 
    Linearly look for the best index to chunk
**/
function linearSearch<T extends UploadDataLookup, K extends keyof T>(
  data: T[K][],
  targetSize: number,
): number {
  let size = 0;
  let index = 0;
  const acceptedTargetSize = BATCH_THRESHOLD * targetSize;
  while (size < acceptedTargetSize && index < data.length) {
    size += getSizeOfObject([data[index]]);
    index++;
  }
  return index - 1;
}
function handleSearchError<T extends UploadDataLookup, K extends keyof T>(
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
    throw new Error(
      'Entity/Relationship is too big to ingest. This usually happens when item has a lot of long attributes.',
    );
  }
}

export function getSizeOfObject<T extends UploadDataLookup, K extends keyof T>(
  object: T[K][],
): number {
  try {
    return Buffer.byteLength(JSON.stringify(object), 'utf8');
  } catch (error) {
    if (error instanceof RangeError) {
      //If object is too large to size, stringify runs out of memory. We fallback to the max batchSize.
      return MAX_BATCH_SIZE_IN_BYTES + 1;
    }
    throw error;
  }
}
