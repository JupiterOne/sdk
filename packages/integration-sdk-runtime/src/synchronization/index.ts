import path from 'path';
import chunk from 'lodash/chunk';
import pMap from 'p-map';

import {
  Entity,
  IntegrationError,
  PartialDatasets,
  Relationship,
  SynchronizationJob,
} from '@jupiterone/integration-sdk-core';
import {chunkArray as chunkBySize} from '@shelf/array-chunk-by-size';
import { IntegrationLogger } from '../logger';

import { ExecuteIntegrationResult } from '../execution';

import { getRootStorageDirectory, readJsonFromPath } from '../fileSystem';
import { synchronizationApiError } from './error';
import { ApiClient } from '../api';
import { timeOperation } from '../metrics';
import { FlushedGraphObjectData } from '../storage/types';
import { AttemptContext, retry } from '@lifeomic/attempt';
import { randomUUID as uuid } from 'crypto';
import { createEventPublishingQueue } from './events';
import { AxiosInstance } from 'axios';
import { iterateParsedGraphFiles } from '..';
import { shrinkBatchRawData } from './shrinkBatchRawData';

export { synchronizationApiError };
export { createEventPublishingQueue } from './events';
export const BYTES_IN_MB = 1048576
export const DEFAULT_UPLOAD_BATCH_SIZE = 250;
const UPLOAD_CONCURRENCY = 6;

export enum RequestHeaders {
  CorrelationId = 'JupiterOne-Correlation-Id',
}

export interface SynchronizeInput {
  logger: IntegrationLogger;
  apiClient: ApiClient;

  /**
   * The synchronization job `source` value.
   *
   * The JupiterOne bulk upload API requires a `source` value is provided to identify the source
   * of the data being uploaded. When running in the managed infrastructure, `'integration-managed'` is used. When running
   * outside the managed infrastructure, `'integration-managed'`, `'integration-external'`, or `'api'` can be used.
   *
   * Using `'api'` will allow data to be uploaded without associating it with a specific integration instance. This is
   * useful when using the SDK to upload data from a script or other non-integration source.
   */
  source: 'integration-managed' | 'integration-external' | 'api';

  /**
   * The `scope` value used when creating the synchronization job. This value will be null when the
   * synchronization job is configured with source `'integration-managed'` or `'integration-external'`.
   */
  scope?: string;

  /**
   * The integration instance ID provided to execute a synchronization job. This value will be null when the
   * synchronization job is configured with source `'api'`.
   */
  integrationInstanceId?: string;

  /**
   * The integration job ID to associate with the synchronization job. This will be used as the synchronization job ID.
   * When no value is provided, a new job will be created.
   */
  integrationJobId?: string;

  uploadBatchSize?: number | undefined;
  uploadRelationshipBatchSize?: number | undefined;

  // if true, we will create batches up to batchPayloadSizeInMB
  batchOnPayloadSize?: boolean; 
  batchPayloadSizeInMB?: number; // must be at least 5

  skipFinalize?: boolean;
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
    if (input.skipFinalize) {
      return await synchronizationStatus(jobContext);
    } else {
      return await finalizeSynchronization({
        ...jobContext,
        partialDatasets: await getPartialDatasets(),
      });
    }
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

/**
 * Build a synchronization job configuration for the specified source.
 *
 * The synchronization job API requires `integration-*` sources to provide an `integrationInstanceId` and optionally
 * a known `integrationJobId`. The latter is used by the synchronization job API as the synchronization job ID. When no value is
 * provided, the API will create a new integration job and synchronization job, both with the same ID.
 *
 * The synchronization job API requires an `api` source to provide a `scope`. An integration job will not be associated
 * with the synchronization job and no integration job will be created. This allows the SDK to be used to upload data
 * without associating it with a specific integration instance.
 */
function buildJobConfiguration({
  source,
  scope,
  integrationInstanceId,
  integrationJobId,
}: SynchronizeInput) {
  return source === 'api'
    ? { source, scope }
    : { source, integrationInstanceId, integrationJobId };
}

export interface SynchronizationJobContext {
  apiClient: ApiClient;
  job: SynchronizationJob;
  logger: IntegrationLogger;
  uploadBatchSize?: number | undefined;
  uploadRelationshipBatchSize?: number | undefined;
  batchOnPayloadSize?: boolean; // if true, we will create batches up to batchPayloadSizeInMB
  batchPayloadSizeInMB?: number; // must be at least 5
}

/**
 * Initializes a synchronization job
 */
export async function initiateSynchronization(
  input: SynchronizeInput,
): Promise<SynchronizationJobContext> {
  const { logger, apiClient, uploadBatchSize, uploadRelationshipBatchSize, batchOnPayloadSize, batchPayloadSizeInMB } =
    input;
  
  const jobConfiguration = buildJobConfiguration(input);

  logger.info('Initiating synchronization job...');

  let job: SynchronizationJob;
  try {
    const response = await apiClient.post(
      '/persister/synchronization/jobs',
      jobConfiguration,
    );
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
      ...jobConfiguration,
      integrationJobId:
        jobConfiguration.integrationJobId ?? job.integrationJobId,
      synchronizationJobId: job.id,
    }),
    uploadBatchSize,
    uploadRelationshipBatchSize,
    batchOnPayloadSize,
    batchPayloadSizeInMB
  };
}

type SynchronizationStatusInput = SynchronizationJobContext;

export async function synchronizationStatus({
  apiClient,
  job,
}: SynchronizationStatusInput): Promise<SynchronizationJob> {
  let status: SynchronizationJob;

  try {
    const response = await apiClient.get(
      `/persister/synchronization/jobs/${job.id}`,
    );
    status = response.data.job;
  } catch (err) {
    throw synchronizationApiError(
      err,
      'Error occurred fetching synchronization job status.',
    );
  }

  return status;
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
  uploadRelationshipsBatchSize?: number,
  batchOnPayloadSize: boolean = false,
  batchPayloadSizeInMB?: number
) {
  // todo: possibly make new function for uploading entity/relationship together
  // todo: should we use diff function at this point for the actual uploading when batching on size (possibly)
  const entityBatchSize = uploadBatchSize;
  const relationshipsBatchSize =
    uploadRelationshipsBatchSize || uploadBatchSize;

  try {
    if (
      Array.isArray(graphObjectData.entities) &&
      graphObjectData.entities.length != 0
    ) {
      synchronizationJobContext.logger.debug(
        {
          entities: graphObjectData.entities.length,
        },
        'Preparing batches of entities for upload',
      );

      await uploadData(
        synchronizationJobContext,
        'entities',
        graphObjectData.entities,
        entityBatchSize,
        batchOnPayloadSize,
        batchPayloadSizeInMB
      );

      synchronizationJobContext.logger.debug(
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
      synchronizationJobContext.logger.debug(
        {
          relationships: graphObjectData.relationships.length,
        },
        'Preparing batches of relationships for upload',
      );

      await uploadData(
        synchronizationJobContext,
        'relationships',
        graphObjectData.relationships,
        relationshipsBatchSize,
        batchOnPayloadSize,
        batchPayloadSizeInMB
      );

      synchronizationJobContext.logger.debug(
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
 * Uploads data collected by the integration.
 */
export async function uploadCollectedData(context: SynchronizationJobContext) {
  context.logger.synchronizationUploadStart(context.job);

  async function uploadGraphObjectFile(parsedData: FlushedGraphObjectData) {
    await uploadGraphObjectData(
      context,
      parsedData,
      context.uploadBatchSize,
      context.uploadRelationshipBatchSize,
      context.batchOnPayloadSize,
      context.batchPayloadSizeInMB
    );
  }

  await timeOperation({
    logger: context.logger,
    metricName: 'duration-sync-upload',
    operation: () => iterateParsedGraphFiles(uploadGraphObjectFile),
  });

  context.logger.synchronizationUploadEnd(context.job);
}

export interface UploadDataLookup {
  entities: Entity;
  relationships: Relationship;
}

interface UploadDataChunkParams<T extends UploadDataLookup, K extends keyof T> {
  logger: IntegrationLogger;
  apiClient: AxiosInstance;
  jobId: string;
  type: K;
  batch: T[K][];
  compressed?: boolean;
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
export function getSystemErrorResponseData(
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
    shrinkBatchRawData(batch, logger);
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
  K extends keyof T, // todo: use compressed 
>({ logger, apiClient, jobId, type, batch, compressed = false }: UploadDataChunkParams<T, K>) {
  const uploadCorrelationId = uuid();

  await retry(
    async (ctx) => {
      // TODO [INT-3707]: on first try, shrink raw data of every entity
      // to the point where each entity is < 1MB
      logger.debug(
        {
          uploadCorrelationId,
          uploadType: type,
          attemptNum: ctx.attemptNum,
          batchSize: batch.length,
          compressed,
        },
        'Uploading data...',
      );

      const headers = {
            // NOTE: Other headers that were applied when the client was created,
            // are still maintained
            [RequestHeaders.CorrelationId]: uploadCorrelationId,
      };
      if(compressed) {
        headers['Content-Encoding'] = 'gzip'
      }

      await apiClient.post(
        `/persister/synchronization/jobs/${jobId}/${type as string}`,
        {
          [type]: batch,
        },
        {
          headers,
        },
      );

      logger.debug(
        {
          uploadCorrelationId,
          uploadType: type,
          attemptNum: ctx.attemptNum,
          batchSize: batch.length,
          compressed,
        },
        'Finished uploading batch',
      );
    },
    {
      maxAttempts: 5,
      delay: 200,
      factor: 1.05,
      handleError(err, attemptContext) {
        try {
          handleUploadDataChunkError({
            err,
            attemptContext,
            logger,
            batch,
            uploadCorrelationId,
          });
        } catch (error) {
          logger.warn(
            { error },
            'handleUploadDataChunkError function threw',
            error,
          );
          throw error;
        }
      },
    },
  );
}

export async function uploadData<T extends UploadDataLookup, K extends keyof T>(
  { job, apiClient, logger }: SynchronizationJobContext,
  type: K,
  data: T[K][],
  uploadBatchSize?: number,
  batchOnPayloadSize?: boolean,
  batchPayloadSizeInMB?: number,
) {
  let batches;
  if(batchOnPayloadSize && batchPayloadSizeInMB){
    try {
      batches = chunkBySize({input:data,bytesSize: batchPayloadSizeInMB * BYTES_IN_MB},)
    } catch (error) {
      batches = chunk(data, uploadBatchSize || DEFAULT_UPLOAD_BATCH_SIZE);
    }
  } else{
    batches = chunk(data, uploadBatchSize || DEFAULT_UPLOAD_BATCH_SIZE);
  }
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
          compressed: batchOnPayloadSize
        });
      }
    },
    { concurrency: UPLOAD_CONCURRENCY },
  );
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
