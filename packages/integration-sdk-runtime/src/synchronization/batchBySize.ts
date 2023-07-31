import {
    Entity,
  IntegrationLogger,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { UploadDataLookup } from '.';
import { MAX_BATCH_SIZE_IN_BYTES } from './shrinkBatchRawData';

export function batchGraphObjectsBySizeInBytes<T extends UploadDataLookup, K extends keyof T>(
    graphObjects: T[K][],
    maximumBatchSizeInBytes: number,
    logger: IntegrationLogger,
  ): T[K][][] {
    const batches: T[K][][] = [];
  
    let currentBatch: T[K][] = [];
    let currentBatchSize: number = 0;
    for (const graphObject of graphObjects) {
      const typedGraphObject = graphObject as Entity | Relationship
      
      let graphObjectSizeInBytes = getSizeOfObject(graphObject);
      
      if (graphObjectSizeInBytes > maximumBatchSizeInBytes) {
        const rawDataSizeInBytes = typedGraphObject._rawData ? getSizeOfObject(typedGraphObject._rawData) : 0;

        if (graphObjectSizeInBytes-rawDataSizeInBytes > maximumBatchSizeInBytes) {
          logger.warn({ 
            _key: typedGraphObject._key, _type: typedGraphObject.type, maximumBatchSizeInBytes, graphObjectSizeInBytes, rawDataSizeInBytes,
           }, 'Graph object is larger than batch size in bytes; cannot upload graph object.');
           continue;
        } else {
          logger.info({ 
            _key: typedGraphObject._key, _type: typedGraphObject.type, maximumBatchSizeInBytes, graphObjectSizeInBytes, rawDataSizeInBytes,
           }, 'Graph object is larger than batch size in bytes; removing raw data.');
           graphObjectSizeInBytes -= rawDataSizeInBytes;
           typedGraphObject._rawData = undefined;
        }
      }
  
      if (graphObjectSizeInBytes + currentBatchSize >= maximumBatchSizeInBytes) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchSize = 0;
      }
      currentBatch.push(graphObject);
      currentBatchSize += graphObjectSizeInBytes;
    }
  
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    return batches;
  }

export function getSizeOfObject(
  object: any,
): number {
  try {
    return Buffer.byteLength(JSON.stringify(object), 'utf8');
  } catch (error) {
    if (error instanceof RangeError) {
      //If object is too large to size, stringify runs out of memory. We fallback to the max batchSize.
      //This is highly unlikely since it should only happen after ~500MB.
      return MAX_BATCH_SIZE_IN_BYTES + 1;
    }
    throw error;
  }
}
