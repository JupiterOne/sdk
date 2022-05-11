import path from 'path';
import chunk from 'lodash/chunk';
import pMap from 'p-map';

import {
  PartialDatasets,
  Entity,
  EntityRawData,
  Relationship,
  SynchronizationJob,
  IntegrationError,
  IntegrationErrorEventName,
} from '@jupiterone/integration-sdk-core';

import { IntegrationLogger } from '../logger';

import { ExecuteIntegrationResult } from '../execution';

import { getRootStorageDirectory, readJsonFromPath } from '../fileSystem';
import { synchronizationApiError } from './error';
import { ApiClient } from '../api';
import { timeOperation } from '../metrics';
import { FlushedGraphObjectData } from '../storage/types';
import { AttemptContext, retry } from '@lifeomic/attempt';
import { v4 as uuid } from 'uuid';

export { synchronizationApiError };
import { createEventPublishingQueue } from './events';
import { AxiosInstance } from 'axios';
import { iterateParsedGraphFiles } from '..';
export { createEventPublishingQueue } from './events';

const UPLOAD_BATCH_SIZE = 250;
const UPLOAD_CONCURRENCY = 6;

// Uploads above 6 MB will fail.  This is technically
// 6291456 bytes, but we need header space.  Most web
// servers will only allow 8KB or 16KB as a max header
// size, so 6291456 - 16384 = 6275072
// to be completely safe, we are using 6000000 bytes as default
const MAX_BATCH_SIZE = 6000000;

// TODO [INT-3707]: uncomment and use when implementing method
// to shrink single entity's rawData until that entity is < 1MB

// const MAX_RAW_DATA_SIZE = 1194304;

export enum RequestHeaders {
  CorrelationId = 'JupiterOne-Correlation-Id',
}

interface SynchronizeInput {
  logger: IntegrationLogger;
  apiClient: ApiClient;
  integrationInstanceId: string;
}

/**
 * Performs synchronization of collected data.
 */
export async function synchronizeCollectedData(
  input: SynchronizeInput,
): Promise<SynchronizationJob> {
  const jobContext = await initiateSynchronization(input);

  const eventPublishingQueue = createEventPublishingQueue(jobContext);
  jobContext.logger.on('event', (event) => eventPublishingQueue.enqueue(event));

  try {
    await uploadCollectedData(jobContext);

    return await finalizeSynchronization({
      ...jobContext,
      partialDatasets: await getPartialDatasets(),
    });
  } catch (err) {
    jobContext.logger.error(
      err,
      'Error occurred while synchronizing collected data',
    );

    try {
      await abortSynchronization({ ...jobContext, reason: err.message });
    } catch (abortError) {
      jobContext.logger.error(
        abortError,
        'Error occurred while aborting synchronization job.',
      );
      throw abortError;
    }

    throw err;
  } finally {
    await eventPublishingQueue.onIdle();
  }
}

export interface SynchronizationJobContext {
  apiClient: ApiClient;
  job: SynchronizationJob;
  logger: IntegrationLogger;
}

/**
 * Initializes a synchronization job
 */
export async function initiateSynchronization({
  logger,
  apiClient,
  integrationInstanceId,
}: SynchronizeInput): Promise<SynchronizationJobContext> {
  logger.info('Initiating synchronization job...');

  let job: SynchronizationJob;
  try {
    const response = await apiClient.post('/persister/synchronization/jobs', {
      source: 'integration-managed',
      integrationInstanceId,
    });

    job = response.data.job;
  } catch (err) {
    throw synchronizationApiError(
      err,
      'Error occurred while initiating synchronization job',
    );
  }

  return {
    apiClient,
    job,
    logger: logger.child({
      synchronizationJobId: job.id,
      integrationJobId: job.integrationJobId,
      integrationInstanceId: job.integrationInstanceId,
    }),
  };
}

interface FinalizeSynchronizationInput extends SynchronizationJobContext {
  partialDatasets: PartialDatasets;
}

/**
 * Posts to the synchronization job API to trigger
 * the synchronization of all uploaded entities and relationships.
 */
export async function finalizeSynchronization({
  apiClient,
  job,
  logger,
  partialDatasets,
}: FinalizeSynchronizationInput): Promise<SynchronizationJob> {
  logger.info('Finalizing synchronization...');

  let finalizedJob: SynchronizationJob;

  try {
    const response = await apiClient.post(
      `/persister/synchronization/jobs/${job.id}/finalize`,
      {
        partialDatasets,
      },
    );
    finalizedJob = response.data.job;
  } catch (err) {
    throw synchronizationApiError(
      err,
      'Error occurred while finalizing synchronization job.',
    );
  }

  logger.info(
    { synchronizationJob: finalizedJob },
    'Synchronization finalization result.',
  );

  return finalizedJob;
}

async function getPartialDatasets() {
  const summary = await readJsonFromPath<ExecuteIntegrationResult>(
    path.resolve(getRootStorageDirectory(), 'summary.json'),
  );

  return summary.metadata.partialDatasets;
}

export async function uploadGraphObjectData(
  synchronizationJobContext: SynchronizationJobContext,
  graphObjectData: FlushedGraphObjectData,
  uploadBatchSize?: number,
) {
  try {
    if (
      Array.isArray(graphObjectData.entities) &&
      graphObjectData.entities.length != 0
    ) {
      synchronizationJobContext.logger.info(
        {
          entities: graphObjectData.entities.length,
        },
        'Preparing batches of entities for upload',
      );

      await uploadData(
        synchronizationJobContext,
        'entities',
        graphObjectData.entities,
        uploadBatchSize,
      );

      synchronizationJobContext.logger.info(
        {
          entities: graphObjectData.entities.length,
        },
        'Successfully uploaded entities',
      );
    }

    if (
      Array.isArray(graphObjectData.relationships) &&
      graphObjectData.relationships.length != 0
    ) {
      synchronizationJobContext.logger.info(
        {
          relationships: graphObjectData.relationships.length,
        },
        'Preparing batches of relationships for upload',
      );

      await uploadData(
        synchronizationJobContext,
        'relationships',
        graphObjectData.relationships,
        uploadBatchSize,
      );

      synchronizationJobContext.logger.info(
        {
          relationships: graphObjectData.relationships.length,
        },
        'Successfully uploaded relationships',
      );
    }
  } catch (err) {
    throw synchronizationApiError(err, 'Error uploading collected data');
  }
}

/**
 * Uploads data collected by the integration into the
 */
export async function uploadCollectedData(context: SynchronizationJobContext) {
  context.logger.synchronizationUploadStart(context.job);

  async function uploadGraphObjectFile(parsedData: FlushedGraphObjectData) {
    await uploadGraphObjectData(context, parsedData);
  }

  await timeOperation({
    logger: context.logger,
    metricName: 'duration-sync-upload',
    operation: () => iterateParsedGraphFiles(uploadGraphObjectFile),
  });

  context.logger.synchronizationUploadEnd(context.job);
}

interface UploadDataLookup {
  entities: Entity;
  relationships: Relationship;
}

interface UploadDataChunkParams<T extends UploadDataLookup, K extends keyof T> {
  logger: IntegrationLogger;
  apiClient: AxiosInstance;
  jobId: string;
  type: K;
  batch: T[K][];
}

function isRequestUploadTooLargeError(err): boolean {
  return (
    err.code === 'RequestEntityTooLargeException' ||
    err.response?.status === 413
  );
}

type SystemErrorResponseData = {
  /**
   * The specific system-level error code (e.g. `ENTITY_IS_NOT_ARRAY`)
   */
  code: string;
  /**
   * The specific system-level error message
   * (e.g. `"\"entities\" should be an array"`)
   */
  message: string;
};

/**
 * The JupiterOne system will encapsulate error details in the response in
 * some situations. For example:
 *
 * {
 *   "error": {
 *     "code": "ENTITY_IS_NOT_ARRAY",
 *     "message": "\"entities\" should be an array"
 *   }
 * }
 */
function getSystemErrorResponseData(
  err: any,
): SystemErrorResponseData | undefined {
  return err.response?.data?.error;
}

type HandleUploadDataChunkErrorParams = {
  err: any;
  attemptContext: AttemptContext;
  logger: IntegrationLogger;
  batch: any;
  uploadCorrelationId: string;
};

function handleUploadDataChunkError({
  err,
  attemptContext,
  logger,
  batch,
  uploadCorrelationId,
}: HandleUploadDataChunkErrorParams): void {
  /**
   * The JupiterOne system will encapsulate error details in the response in
   * some situations. For example:
   *
   * {
   *   "error": {
   *     "code": "ENTITY_IS_NOT_ARRAY",
   *     "message": "\"entities\" should be an array"
   *   }
   * }
   */
  const systemErrorResponseData = getSystemErrorResponseData(err);

  logger.info(
    {
      err,
      code: err.code,
      attemptNum: attemptContext.attemptNum,
      systemErrorResponseData,
      attemptsRemaining: attemptContext.attemptsRemaining,
      uploadCorrelationId,
    },
    'Handling upload error...',
  );

  if (isRequestUploadTooLargeError(err)) {
    // shrink rawData further to try and achieve a batch size of < 6MB
    logger.info(`Attempting to shrink rawData`);
    const shrinkResults = shrinkBatchRawData(batch, logger);
    logger.info(shrinkResults, 'Shrink raw data result');
  } else if (systemErrorResponseData?.code === 'JOB_NOT_AWAITING_UPLOADS') {
    throw new IntegrationError({
      code: 'INTEGRATION_UPLOAD_AFTER_JOB_ENDED',
      cause: err,
      fatal: true,
      message:
        'Failed to upload integration data because job has already ended',
    });
  }
}

export async function uploadDataChunk<
  T extends UploadDataLookup,
  K extends keyof T,
>({ logger, apiClient, jobId, type, batch }: UploadDataChunkParams<T, K>) {
  const uploadCorrelationId = uuid();

  await retry(
    async (ctx) => {
      // TODO [INT-3707]: on first try, shrink raw data of every entity
      // to the point where each entity is < 1MB
      logger.info(
        {
          uploadCorrelationId,
          uploadType: type,
          attemptNum: ctx.attemptNum,
          batchSize: batch.length,
        },
        'Uploading data...',
      );

      await apiClient.post(
        `/persister/synchronization/jobs/${jobId}/${type}`,
        {
          [type]: batch,
        },
        {
          headers: {
            // NOTE: Other headers that were applied when the client was created,
            // are still maintained
            [RequestHeaders.CorrelationId]: uploadCorrelationId,
          },
        },
      );
    },
    {
      maxAttempts: 5,
      delay: 200,
      factor: 1.05,
      handleError(err, attemptContext) {
        handleUploadDataChunkError({
          err,
          attemptContext,
          logger,
          batch,
          uploadCorrelationId,
        });
      },
    },
  );
}

export async function uploadData<T extends UploadDataLookup, K extends keyof T>(
  { job, apiClient, logger }: SynchronizationJobContext,
  type: K,
  data: T[K][],
  uploadBatchSize?: number,
) {
  const batches = chunk(data, uploadBatchSize || UPLOAD_BATCH_SIZE);
  await pMap(
    batches,
    async (batch: T[K][]) => {
      if (batch.length) {
        await uploadDataChunk({
          apiClient,
          logger,
          jobId: job.id,
          type,
          batch,
        });
      }
    },
    { concurrency: UPLOAD_CONCURRENCY },
  );
}

// Interface for storing both the key value and total size of a given array entry
interface KeyAndSize {
  key: string;
  size: number;
}

// Interface for shrink run results
interface ShrinkRawDataResults {
  initialSize: number;
  totalSize: number;
  itemsRemoved: number;
  totalTime: number;
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
): ShrinkRawDataResults {
  const startTimeInMilliseconds = Date.now();
  let totalBatchSize = Buffer.byteLength(JSON.stringify(batchData));
  const initialBatchSize = totalBatchSize;
  let itemsRemoved = 0;
  const sizeOfTruncated = Buffer.byteLength("'TRUNCATED'");

  while (totalBatchSize > maxBatchSize) {
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
      // Find largest item within largest that element
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
  }

  const endTimeInMilliseconds = Date.now();
  return {
    initialSize: initialBatchSize,
    totalSize: totalBatchSize,
    itemsRemoved,
    totalTime: endTimeInMilliseconds - startTimeInMilliseconds,
  };
}

interface AbortSynchronizationInput extends SynchronizationJobContext {
  reason?: string;
}
/**
 * Aborts a synchronization job
 */
export async function abortSynchronization({
  logger,
  apiClient,
  job,
  reason,
}: AbortSynchronizationInput) {
  logger.info('Aborting synchronization job...');

  let abortedJob: SynchronizationJob;

  try {
    const response = await apiClient.post(
      `/persister/synchronization/jobs/${job.id}/abort`,
      { reason },
    );
    abortedJob = response.data.job;
  } catch (err) {
    throw synchronizationApiError(
      err,
      'Error occurred while aborting synchronization job',
    );
  }

  return abortedJob;
}
