import {
  Entity,
  EntityRawData,
  IntegrationError,
  IntegrationErrorEventName,
} from '@jupiterone/integration-sdk-core';
import { UploadDataLookup } from '.';
import { IntegrationLogger } from '../logger';

// Uploads above 6 MiB will fail.  This is technically
// 6144000 bytes, but we need header space.  Most web
// servers will only allow 8KB or 16KB as a max header
// size, so 6144000 - 16384 = 6127616 bytes
// however, we do have to consider the size of whatever aws sdk wraps
// our payload in. In practice we have seen batches as small as 5800000
// fail. To be completely safe, we are using 5500000 bytes as default
const MAX_BATCH_SIZE = 5500000;

// TODO [INT-3707]: uncomment and use when implementing method
// to shrink single entity's rawData until that entity is < 1MB

// const MAX_RAW_DATA_SIZE = 1194304;

/**
 * Removes data from the rawData of the largest entity until the overall size
 * of the data object is less than maxSize (defaulted to MAX_BATCH_SIZE).
 *
 * @param batchData
 */
export function shrinkBatchRawData(
  batchData: UploadDataLookup[keyof UploadDataLookup][],
  logger: IntegrationLogger,
  maxBatchSize = MAX_BATCH_SIZE,
): void {
  logger.info(`Attempting to shrink rawData`);
  const startTimeInMilliseconds = Date.now();
  let totalBatchSize = Buffer.byteLength(JSON.stringify(batchData));
  const initialBatchSize = totalBatchSize;
  let itemsRemoved = 0;
  const sizeOfTruncated = Buffer.byteLength("'TRUNCATED'");

  do {
    // Find Entity with largest rawData
    const entityWithLargestRawData =
      getEntityFromBatchWithLargestRawData(batchData);

    // If we don't have any entities to shrink or the optional _rawData array is empty,
    // we have no other options than to throw an error.
    if (entityWithLargestRawData?._rawData) {
      // Find largest element of the _rawData array (typically at index 0, but check to be certain)
      const largestRawDataEntry = getLargestRawDataEntry(
        entityWithLargestRawData._rawData,
      );
      // Find largest item within that element
      const largestItemLookup = getLargestItemKeyAndByteSize(
        largestRawDataEntry.rawData,
      );

      // if we can no longer truncate, log and error out
      if (largestItemLookup.size === sizeOfTruncated) {
        const sizeDistribution = {};
        for (const entity of batchData) {
          sizeDistribution[entity._key] = Buffer.byteLength(
            JSON.stringify(entity),
          );
        }
        logger.error(
          {
            largestEntityPropSizeMap: getPropSizeMapFromEntity(
              getLargestEntityInBatch(batchData),
            ),
            totalBatchSize: totalBatchSize,
            sizeDistribution,
          },
          'Encountered upload size error after fully shrinking. This is likely due to properties on the entity being too large in size.',
        );
        logger.publishErrorEvent({
          name: IntegrationErrorEventName.EntitySizeLimitEncountered,
          description: `Failed to upload integration data because the payload is too large. This batch of ${batchData.length} entities is still ${totalBatchSize} bytes after truncating all non-mapped properties.`,
        });
        throw new IntegrationError({
          code: 'INTEGRATION_UPLOAD_FAILED',
          fatal: false,
          message:
            'Failed to upload integration data because the payload is still too large after performing as much shrinking as possible',
        });
      }

      // Truncate largest item and recalculate size to see if we need to continue truncating additional items
      largestRawDataEntry.rawData[largestItemLookup.key] = 'TRUNCATED';
      itemsRemoved += 1;
      totalBatchSize =
        totalBatchSize - largestItemLookup.size + sizeOfTruncated;
    } else {
      // Cannot find any entities to shrink, so throw
      throw new IntegrationError({
        code: 'INTEGRATION_UPLOAD_FAILED',
        fatal: false,
        message:
          'Failed to upload integration data because payload is too large and cannot shrink',
      });
    }
  } while (totalBatchSize > maxBatchSize);

  const endTimeInMilliseconds = Date.now();
  logger.info(
    {
      initialSize: initialBatchSize,
      totalSize: totalBatchSize,
      itemsRemoved,
      totalTime: endTimeInMilliseconds - startTimeInMilliseconds,
    },
    'Shrink raw data result',
  );
}

// Interface for storing both the key value and total size of a given array entry
interface KeyAndSize {
  key: string;
  size: number;
}

/**
 * Helper function to find the largest entry in an object and return its key
 * and approximate byte size.  We JSON.stringify as a method to try and have
 * an apples to apples comparison no matter what the data type of the value is.
 *
 * @param data
 * @returns
 */
function getLargestItemKeyAndByteSize(data: any): KeyAndSize {
  const largestItem: KeyAndSize = { key: '', size: 0 };
  for (const item in data) {
    const length = data[item]
      ? Buffer.byteLength(JSON.stringify(data[item]))
      : 0;
    if (length > largestItem.size) {
      largestItem.key = item;
      largestItem.size = length;
    }
  }

  return largestItem;
}

/**
 * Helper function to find the entity in our data array with the largest rawData and return it.
 * We JSON.stringify as a method to try and have an apples to apples comparison
 * no matter what the data type of the value is.
 *
 * @param data
 * @returns
 */
function getEntityFromBatchWithLargestRawData(
  data: UploadDataLookup[keyof UploadDataLookup][],
): Entity {
  let itemWithLargestRawData;
  let largestRawDataSize = Number.MIN_SAFE_INTEGER;

  for (const item of data) {
    const length = item?._rawData
      ? Buffer.byteLength(JSON.stringify(item._rawData))
      : 0;
    if (length > largestRawDataSize) {
      itemWithLargestRawData = item;
      largestRawDataSize = length;
    }
  }
  return itemWithLargestRawData;
}

function getLargestEntityInBatch(
  data: UploadDataLookup[keyof UploadDataLookup][],
): Entity {
  let largestEntity;
  let largestEntitySize = Number.MIN_SAFE_INTEGER;

  for (const item of data) {
    const length = item ? Buffer.byteLength(JSON.stringify(item)) : 0;
    if (length > largestEntitySize) {
      largestEntity = item;
      largestEntitySize = length;
    }
  }
  return largestEntity;
}

/**
 * Helper function to find the largest element of the _rawData array in an Entity and return
 * it.  We JSON.stringify as a method to try and have an apples to apples comparison
 * no matter what the data type of the value is.
 *
 * @param data
 * @returns
 */
function getLargestRawDataEntry(data: EntityRawData[]): EntityRawData {
  let largestItem;
  let largestItemSize = Number.MIN_SAFE_INTEGER;

  for (const item of data) {
    const length = item ? Buffer.byteLength(JSON.stringify(item)) : 0;
    if (length > largestItemSize) {
      largestItem = item;
      largestItemSize = length;
    }
  }

  return largestItem;
}

/**
 * Helper function to generate a map of property sizes for a given Entity.
 * This is used to determine what property keys on an Entity have a particularly large value.
 * Intended to be used when logging upload errors due to large payload size.
 *
 * @param data
 * @returns
 */
function getPropSizeMapFromEntity(data: Entity): any {
  const propSizeMap = {};

  for (const [key, value] of Object.entries(data)) {
    propSizeMap[key] = Buffer.byteLength(JSON.stringify(value));
  }

  return propSizeMap;
}
