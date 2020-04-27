import path from 'path';
import times from 'lodash/times';

import {
  SynchronizationJob,
  SynchronizationJobStatus,
  initiateSynchronization,
  uploadCollectedData,
  finalizeSynchronization,
  synchronizeCollectedData,
} from '../index';

import { getApiBaseUrl, createApiClient } from '../../api';
import { PartialDatasets, ExecuteIntegrationResult } from '../../execution';
import { createIntegrationLogger } from '../../execution/logger';

import {
  loadProjectStructure,
  restoreProjectStructure,
} from '../../../__tests__/loadProjectStructure';

import { getRootStorageDirectory, readJsonFromPath } from '../../../fileSystem';

afterEach(() => {
  restoreProjectStructure();
});

describe('initiateSynchronization', () => {
  test('hits synchronization job api to start a new job', async () => {
    const job = generateSynchronizationJob();

    const context = createTestContext();
    const { apiClient } = context;
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        job,
      },
    });

    const synchronizationContext = await initiateSynchronization(context);

    expect(synchronizationContext.job).toEqual(job);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/persister/synchronization/jobs', {
      source: 'integration-managed',
      integrationInstanceId: context.integrationInstanceId,
    });
  });

  test('throws error if integration instance cannot be found', async () => {
    const context = createTestContext();
    const { apiClient } = context;
    const postSpy = jest.spyOn(apiClient, 'post').mockRejectedValue({
      response: {
        data: {
          error: {
            code: 'SYNC_JOB_INVALID_INTEGRATION_INSTANCE',
            message: 'Integration instance not found',
          },
        },
      },
    });

    await expect(initiateSynchronization(context)).rejects.toThrow(
      /instance not found/,
    );
    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});

describe('uploadCollectedData', () => {
  test('crawls through files and uploads the data', async () => {
    loadProjectStructure('synchronization');

    const job = generateSynchronizationJob();
    const context = createTestContext();
    const { apiClient } = context;

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        job,
      },
    });

    await uploadCollectedData({
      ...context,
      job,
    });

    expect(postSpy).toHaveBeenCalledTimes(4);
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      {
        entities: times(3, (index) =>
          expect.objectContaining({ _key: `entity-${index + 1}` }),
        ),
      },
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      {
        entities: times(3, (index) =>
          expect.objectContaining({ _key: `entity-${index + 4}` }),
        ),
      },
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      {
        relationships: times(2, (index) =>
          expect.objectContaining({ _key: `relationship-${index + 1}` }),
        ),
      },
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      {
        relationships: [expect.objectContaining({ _key: `relationship-3` })],
      },
    );
  });
});

describe('finalizeSynchronization', () => {
  test('sends partial datasets read from summary.json', async () => {
    loadProjectStructure('synchronization');

    const job = generateSynchronizationJob();
    const context = createTestContext();
    const { apiClient } = context;

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        job,
      },
    });

    const partialDatasets: PartialDatasets = {
      types: ['partial_type_a', 'partial_type_a'],
    };

    const returnedJob = await finalizeSynchronization({
      ...context,
      job,
      partialDatasets,
    });

    expect(returnedJob).toEqual(job);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/finalize`,
      {
        partialDatasets,
      },
    );
  });
});

describe('synchronizeCollectedData', () => {
  test('creates job, uploads collected data, and starts finalization', async () => {
    loadProjectStructure('synchronization');

    const context = createTestContext();
    const job = generateSynchronizationJob();
    const finalizedJob = {
      ...job,
      status: SynchronizationJobStatus.FINALIZE_PENDING,
    };

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation((path: string): any => {
        if (path === `/persister/synchronization/jobs/${job.id}/finalize`) {
          return { data: { job: finalizedJob } };
        }

        return {
          data: {
            job,
          },
        };
      });

    const returnedJob = await synchronizeCollectedData(context);
    expect(returnedJob).toEqual(finalizedJob);

    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      '/persister/synchronization/jobs',
      {
        source: 'integration-managed',
        integrationInstanceId: context.integrationInstanceId,
      },
    );

    expect(
      postSpy,
    ).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      { entities: expect.any(Array) },
    );

    expect(
      postSpy,
    ).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      { relationships: expect.any(Array) },
    );

    const summary = await readJsonFromPath<ExecuteIntegrationResult>(
      path.resolve(getRootStorageDirectory(), 'summary.json'),
    );

    const { partialDatasets } = summary.metadata;

    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/finalize`,
      {
        partialDatasets,
      },
    );
  });
});

function createTestContext() {
  const apiClient = createApiClient({
    apiBaseUrl: getApiBaseUrl(),
    account: 'test-account',
  });

  const logger = createIntegrationLogger({
    name: 'test',
  });

  return { apiClient, logger, integrationInstanceId: 'test-instance' };
}

function generateSynchronizationJob(): SynchronizationJob {
  return {
    id: 'test',
    status: SynchronizationJobStatus.AWAITING_UPLOADS,
    startTimestamp: Date.now(),
    numEntitiesUploaded: 0,
    numEntitiesCreated: 0,
    numEntitiesUpdated: 0,
    numEntitiesDeleted: 0,
    numRelationshipsUploaded: 0,
    numRelationshipsCreated: 0,
    numRelationshipsUpdated: 0,
    numRelationshipsDeleted: 0,
  };
}
