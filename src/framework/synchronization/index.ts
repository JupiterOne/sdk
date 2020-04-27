import path from 'path';
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
import {
  unexpectedSynchronizationError,
  integrationInstanceNotFoundError,
} from './error';

export * from './types';

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
    logger.error(err, 'Error occurred while initiating synchronization job.');
    if (err.response) {
      const { status } = err.response;
      const { code, message } = err.response.data.error;
      if (status === 400 && code === 'SYNC_JOB_INVALID_INTEGRATION_INSTANCE') {
        throw integrationInstanceNotFoundError(integrationInstanceId);
      }

      throw unexpectedSynchronizationError(code, message);
    }

    throw err;
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
    logger.error(err, 'Error occurred while initiating synchronization job.');
    if (err.response) {
      const { code, message } = err.response.data.error;
      throw unexpectedSynchronizationError(code, message);
    }
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
export async function uploadCollectedData({
  apiClient,
  job,
  logger,
}: SynchronizationJobContext) {
  await walkDirectory({
    path: 'graph',
    async iteratee({ filePath, data }) {
      logger.info(
        {
          file: path.relative(getRootStorageDirectory(), filePath),
        },
        'Uploading...',
      );

      const parsedData = JSON.parse(data);

      try {
        if (Array.isArray(parsedData.entities) && parsedData.entities.length) {
          await apiClient.post(
            `/persister/synchronization/jobs/${job.id}/entities`,
            { entities: parsedData.entities },
          );
        }

        if (
          Array.isArray(parsedData.relationships) &&
          parsedData.relationships.length
        ) {
          await apiClient.post(
            `/persister/synchronization/jobs/${job.id}/relationships`,
            { relationships: parsedData.relationships },
          );
        }
      } catch (err) {
        if (err.response) {
          const { code, message } = err.response.data.error;
          throw unexpectedSynchronizationError(code, message);
        }

        throw err;
      }
    },
  });
}
