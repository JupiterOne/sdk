import {
  Entity,
  IntegrationLogger,
  IntegrationWarnEventName,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { UploadDataLookup } from '.';

/**
 * Converts an array of graphObjects into an array of groups of this objects.
 * @param graphObjects  Entities or relationships to group.
 *
 * @param uploadBatchSizeInBytes The maximum size of the group of objects.
 *
 * @param logger
 */
export function batchGraphObjectsBySizeInBytes<
  T extends UploadDataLookup,
  K extends keyof T,
>(
  graphObjects: T[K][],
  uploadBatchSizeInBytes: number,
  logger: IntegrationLogger,
): T[K][][] {
  const batches: T[K][][] = [];

  let currentBatch: T[K][] = [];
  let currentBatchSize: number = 0;
  for (const graphObject of graphObjects) {
    const typedGraphObject = graphObject as Entity | Relationship;

    let graphObjectSizeInBytes = 0;
    try {
      graphObjectSizeInBytes = getSizeOfObject(graphObject);
    } catch (err) {
      logger.warn(
        { err, _key: typedGraphObject._key },
        'Failed to calculate size of object in bytes',
      );
      logger.publishWarnEvent({
        name: IntegrationWarnEventName.IngestionLimitEncountered,
        description:
          'Graph object is larger than what can me measured. Will skip graphObject',
      });
      continue;
    }

    if (graphObjectSizeInBytes > uploadBatchSizeInBytes) {
      const rawDataSizeInBytes = typedGraphObject._rawData
        ? getSizeOfObject(typedGraphObject._rawData)
        : 0;

      if (
        graphObjectSizeInBytes - rawDataSizeInBytes >
        uploadBatchSizeInBytes
      ) {
        logger.warn(
          {
            _key: typedGraphObject._key,
            _type: typedGraphObject.type,
            uploadBatchSizeInBytes,
            graphObjectSizeInBytes,
            rawDataSizeInBytes,
          },
          'Graph object is larger than batch size in bytes; cannot upload graph object.',
        );
        logger.publishWarnEvent({
          name: IntegrationWarnEventName.IngestionLimitEncountered,
          description:
            'Graph object is larger than batch size in bytes; cannot upload graph object. Will skip graph object.',
        });
        continue;
      } else {
        logger.info(
          {
            _key: typedGraphObject._key,
            _type: typedGraphObject.type,
            uploadBatchSizeInBytes,
            graphObjectSizeInBytes,
            rawDataSizeInBytes,
          },
          'Graph object is larger than batch size in bytes; removing raw data.',
        );
        graphObjectSizeInBytes -= rawDataSizeInBytes;
        typedGraphObject._rawData = undefined;
      }
    }

    if (graphObjectSizeInBytes + currentBatchSize >= uploadBatchSizeInBytes) {
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

export function getSizeOfObject(object: any): number {
  return Buffer.byteLength(JSON.stringify(object), 'utf8');
}
