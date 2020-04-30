import path from 'path';
import chunk from 'lodash/chunk';
import pMap from 'p-map';

import { ApiClient } from '../api';

import { SynchronizationJob } from './types';
import {
  ExecuteIntegrationResult,
  PartialDatasets,
  IntegrationLogger,
} from '../execution';

import {
  getRootStorageDirectory,
  readJsonFromPath,
  walkDirectory,
} from '../../fileSystem';
import { synchronizationApiError } from './error';
import { Entity, Relationship } from '../types';

export * from './types';

const UPLOAD_BATCH_SIZE = 250;
const UPLOAD_CONCURRENCY = 2;

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

  await uploadCollectedData(jobContext);

  return await finalizeSynchronization({
    ...jobContext,
    partialDatasets: await getPartialDatasets(),
  });
}

interface SynchronizationJobContext {
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
    const errorMessage = 'Error occurred while initiating synchronization job.';
    logger.error(err, errorMessage);
    throw synchronizationApiError(err, errorMessage);
  }

  return {
    apiClient,
    job,
    logger: logger.child({
      integrationInstanceId,
      synchronizationJobId: job.id,
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
  logger.info('Finalizing synchronization');

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
    const errorMessage = 'Error occurred while finalizing synchronization job.';
    logger.error(err, errorMessage);
    throw synchronizationApiError(err, errorMessage);
  }

  return finalizedJob;
}

async function getPartialDatasets() {
  const summary = await readJsonFromPath<ExecuteIntegrationResult>(
    path.resolve(getRootStorageDirectory(), 'summary.json'),
  );

  return summary.metadata.partialDatasets;
}

/**
 * Uploads data collected by the integration into the
 */
export async function uploadCollectedData(context: SynchronizationJobContext) {
  const { logger } = context;
  await walkDirectory({
    path: 'graph',
    async iteratee({ data }) {
      const parsedData = JSON.parse(data);

      try {
        if (Array.isArray(parsedData.entities)) {
          await uploadData(context, 'entities', parsedData.entities);
        }

        if (Array.isArray(parsedData.relationships)) {
          await uploadData(context, 'relationships', parsedData.relationships);
        }
      } catch (err) {
        const errorMessage = 'Error uploading collected data.';
        logger.error(err, errorMessage);
        throw synchronizationApiError(err, errorMessage);
      }
    },
  });
}

interface UploadDataLookup {
  entities: Entity;
  relationships: Relationship;
}

async function uploadData<T extends UploadDataLookup, K extends keyof T>(
  { job, apiClient }: SynchronizationJobContext,
  type: K,
  data: T[K][],
) {
  const batches = chunk(data, UPLOAD_BATCH_SIZE);
  await pMap(
    batches,
    async (batch: T[K][]) => {
      if (batch.length) {
        await apiClient.post(
          `/persister/synchronization/jobs/${job.id}/${type}`,
          { [type]: data },
        );
      }
    },
    { concurrency: UPLOAD_CONCURRENCY },
  );
}
