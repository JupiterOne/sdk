import path from 'path';
import chunk from 'lodash/chunk';
import pMap from 'p-map';

import {
  PartialDatasets,
  Entity,
  Relationship,
  SynchronizationJob,
  IntegrationError,
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
import { shrinkBatchRawData } from './shrinkBatchRawData';
export { createEventPublishingQueue } from './events';

const UPLOAD_BATCH_SIZE = 250;
const UPLOAD_CONCURRENCY = 6;

export enum RequestHeaders {
  CorrelationId = 'JupiterOne-Correlation-Id',
}

export interface SynchronizeInput {
  logger: IntegrationLogger;
  apiClient: ApiClient;
  integrationInstanceId: string;
  integrationJobId?: string;
  uploadBatchSize?: number | undefined;
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
  uploadBatchSize?: number | undefined;
}

/**
 * Initializes a synchronization job
 */
export async function initiateSynchronization({
  logger,
  apiClient,
  integrationInstanceId,
  integrationJobId,
  uploadBatchSize,
}: SynchronizeInput): Promise<SynchronizationJobContext> {
  logger.info('Initiating synchronization job...');

  let job: SynchronizationJob;
  try {
    const response = await apiClient.post('/persister/synchronization/jobs', {
      source: 'integration-managed',
      integrationInstanceId,
      integrationJobId,
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
    uploadBatchSize,
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
  uploadRelationshipsBatchSize?: number,
) {
  const entityBatchSize = uploadBatchSize;
  const relationshipsBatchSize =
    uploadRelationshipsBatchSize || uploadBatchSize;

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
        entityBatchSize,
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
        relationshipsBatchSize,
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
    await uploadGraphObjectData(context, parsedData, context.uploadBatchSize);
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
