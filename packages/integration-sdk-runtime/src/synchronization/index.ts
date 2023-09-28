import path from 'path';
import pMap from 'p-map';

import {
  Entity,
  IntegrationError,
  PartialDatasets,
  Relationship,
  SynchronizationJob,
} from '@jupiterone/integration-sdk-core';

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
import { batchGraphObjectsBySizeInBytes, getSizeOfObject } from './batchBySize';

export { synchronizationApiError };
export { createEventPublishingQueue } from './events';

export const DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES = 5_000_000;

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
}

/**
 * Initializes a synchronization job
 */
export async function initiateSynchronization(
  input: SynchronizeInput,
): Promise<SynchronizationJobContext> {
  const { logger, apiClient } = input;

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
    logger.warn(
      {
        err,
        'err.$response': (err as any)?.$response,
      },
      'Error occurred while initiating synchronization job',
    );
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
    logger.warn(
      {
        err,
        'err.$response': (err as any)?.$response,
      },
      'Error occurred while finalizing synchronization job',
    );
    throw synchronizationApiError(
      err,
      'Error occurred while finalizing synchronization job.',
    );
  }

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
  uploadBatchSizeInBytes?: number,
) {
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
        uploadBatchSizeInBytes,
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
        uploadBatchSizeInBytes,
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
    await uploadGraphObjectData(context, parsedData);
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
      'err.$response': (err as any)?.$response,
    },
    'Handling upload error...',
  );

  if (isRequestUploadTooLargeError(err)) {
    shrinkBatchRawData(batch, logger, DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES);
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
      logger.debug(
        {
          uploadCorrelationId,
          uploadType: type,
          attemptNum: ctx.attemptNum,
          batchSize: batch.length,
        },
        'Uploading data...',
      );
      const startTime = Date.now();
      await apiClient.post(
        `/persister/synchronization/jobs/${jobId}/${type as string}`,
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
      const duration = Date.now() - startTime;
      if (duration >= 10_000) {
        logger.info(
          {
            uploadCorrelationId,
            uploadType: type,
            attemptNum: ctx.attemptNum,
            batchSize: batch.length,
            batchSizeInBytes: getSizeOfObject(batch),
            uploadDuration: duration,
          },
          'Finished uploading big batch',
        );
      }
      logger.debug(
        {
          uploadCorrelationId,
          uploadType: type,
          attemptNum: ctx.attemptNum,
          batchSize: batch.length,
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
  uploadBatchSizeInBytes?: number,
) {
  const batches: T[K][][] = batchGraphObjectsBySizeInBytes(
    data,
    uploadBatchSizeInBytes || DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES,
    logger,
  );

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
