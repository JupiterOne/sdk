import path from 'path';
import times from 'lodash/times';
import noop from 'lodash/noop';

import {
  IntegrationError,
  PartialDatasets,
  SynchronizationJobStatus,
} from '@jupiterone/integration-sdk-core';
import {
  loadProjectStructure,
  restoreProjectStructure,
} from '@jupiterone/integration-sdk-private-test-utils';

import {
  abortSynchronization,
  finalizeSynchronization,
  initiateSynchronization,
  synchronizationStatus,
  synchronizeCollectedData,
  SynchronizeInput,
  uploadCollectedData,
  uploadDataChunk,
} from '../index';

import { createApiClient, getApiBaseUrl } from '../../api';
import { ExecuteIntegrationResult } from '../../execution';
import { createIntegrationLogger } from '../../logger';

import { getRootStorageDirectory, readJsonFromPath } from '../../fileSystem';
import { generateSynchronizationJob } from './util/generateSynchronizationJob';
import { getExpectedRequestHeaders } from '../../../test/util/request';

import * as shrinkBatchRawData from '../shrinkBatchRawData';
import { AxiosError } from 'axios';
import { SynchronizationApiErrorResponse } from '../types';

afterEach(() => {
  delete process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
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

  test('starts a synchronization job with integration job id if provided', async () => {
    const mockIntegrationJobId = 'test-integration-job-id';
    const mockSyncJob = generateSynchronizationJob();
    mockSyncJob.id = mockIntegrationJobId; // sync job ID should be same as integration job ID
    mockSyncJob.integrationJobId = mockIntegrationJobId;

    const context = createTestContext();
    context.integrationJobId = mockIntegrationJobId;
    const { apiClient } = context;

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: { job: mockSyncJob },
    });
    const loggerSpy = jest
      .spyOn(context.logger, 'child')
      .mockImplementation(noop as any);

    const synchronizationContext = await initiateSynchronization(context);

    expect(synchronizationContext.job).toEqual(mockSyncJob);
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith('/persister/synchronization/jobs', {
      source: 'integration-managed',
      integrationInstanceId: context.integrationInstanceId,
      integrationJobId: mockIntegrationJobId,
    });
    expect(loggerSpy).toHaveBeenCalledWith({
      source: 'integration-managed',
      synchronizationJobId: mockIntegrationJobId,
      integrationJobId: mockIntegrationJobId,
      integrationInstanceId: context.integrationInstanceId,
    });
  });

  test('configures scope when source is "api"', async () => {
    const job = generateSynchronizationJob({ source: 'api', scope: 'test' });

    const context = createTestContext({ source: 'api', scope: 'test' });
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
      source: 'api',
      scope: 'test',
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
  beforeEach(() => {
    delete process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
  });

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

    const loggerUploadStartSpy = jest
      .spyOn(context.logger, 'synchronizationUploadStart')
      .mockImplementation(noop);
    const loggerUploadEndSpy = jest
      .spyOn(context.logger, 'synchronizationUploadEnd')
      .mockImplementation(noop);

    await uploadCollectedData({
      ...context,
      job,
    });

    expect(loggerUploadStartSpy).toHaveBeenCalledTimes(1);
    expect(loggerUploadStartSpy).toHaveBeenCalledWith(job);

    expect(loggerUploadEndSpy).toHaveBeenCalledTimes(1);
    expect(loggerUploadEndSpy).toHaveBeenCalledWith(job);

    expect(postSpy).toHaveBeenCalledTimes(4);

    const expectedRequestHeaders = getExpectedRequestHeaders();
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      {
        entities: times(3, (index) =>
          expect.objectContaining({ _key: `entity-${index + 1}` }),
        ),
      },
      expectedRequestHeaders,
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      {
        entities: times(3, (index) =>
          expect.objectContaining({ _key: `entity-${index + 4}` }),
        ),
      },
      expectedRequestHeaders,
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      {
        relationships: times(2, (index) =>
          expect.objectContaining({ _key: `relationship-${index + 1}` }),
        ),
      },
      expectedRequestHeaders,
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      {
        relationships: [expect.objectContaining({ _key: `relationship-3` })],
      },
      expectedRequestHeaders,
    );
  });

  test('should decompress data if INTEGRATION_FILE_COMPRESSION_ENABLED is set', async () => {
    process.env.INTEGRATION_FILE_COMPRESSION_ENABLED = '1';

    loadProjectStructure('synchronization-compressed');

    const job = generateSynchronizationJob();
    const context = createTestContext();
    const { apiClient } = context;

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        job,
      },
    });

    const loggerUploadStartSpy = jest
      .spyOn(context.logger, 'synchronizationUploadStart')
      .mockImplementation(noop);
    const loggerUploadEndSpy = jest
      .spyOn(context.logger, 'synchronizationUploadEnd')
      .mockImplementation(noop);

    await uploadCollectedData({
      ...context,
      job,
    });

    expect(loggerUploadStartSpy).toHaveBeenCalledTimes(1);
    expect(loggerUploadStartSpy).toHaveBeenCalledWith(job);

    expect(loggerUploadEndSpy).toHaveBeenCalledTimes(1);
    expect(loggerUploadEndSpy).toHaveBeenCalledWith(job);

    expect(postSpy).toHaveBeenCalledTimes(4);
    const expectedRequestHeaders = getExpectedRequestHeaders();

    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      {
        entities: times(3, (index) =>
          expect.objectContaining({ _key: `entity-${index + 1}` }),
        ),
      },
      expectedRequestHeaders,
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      {
        entities: times(3, (index) =>
          expect.objectContaining({ _key: `entity-${index + 4}` }),
        ),
      },
      expectedRequestHeaders,
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      {
        relationships: times(2, (index) =>
          expect.objectContaining({ _key: `relationship-${index + 1}` }),
        ),
      },
      expectedRequestHeaders,
    );
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      {
        relationships: [expect.objectContaining({ _key: `relationship-3` })],
      },
      expectedRequestHeaders,
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

describe('synchronizationStatus', () => {
  test('fetches status of job', async () => {
    loadProjectStructure('synchronization');

    const job = generateSynchronizationJob();
    const context = createTestContext();
    const { apiClient } = context;

    const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        job,
      },
    });

    const returnedJob = await synchronizationStatus({
      ...context,
      job,
    });

    expect(returnedJob).toEqual(job);

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}`,
    );
  });
});

describe('abortSynchronization', () => {
  test('sends reason to payload', async () => {
    loadProjectStructure('synchronization');

    const job = generateSynchronizationJob();
    const context = createTestContext();
    const { apiClient } = context;

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        job,
      },
    });

    const returnedJob = await abortSynchronization({
      ...context,
      job,
      reason: 'test',
    });

    expect(returnedJob).toEqual(job);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/abort`,
      {
        reason: 'test',
      },
    );
  });
});

describe('synchronizeCollectedData', () => {
  test('creates job, uploads collected data, and starts finalization with successful retry', async () => {
    loadProjectStructure('synchronization');
    const context = createTestContext();
    const job = generateSynchronizationJob();
    const finalizedJob = {
      ...job,
      status: SynchronizationJobStatus.FINALIZE_PENDING,
    };

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => ({ data: { job } }))
      .mockImplementationOnce((): any => {
        const error: AxiosError<SynchronizationApiErrorResponse> = {
          name: '',
          message: '',
          config: undefined as any,
          isAxiosError: false,
          toJSON: () => ({}),
        };
        throw error;
      })
      .mockImplementationOnce((): any => {
        return { data: { job: finalizedJob } };
      });

    const summary = await readJsonFromPath<ExecuteIntegrationResult>(
      path.resolve(getRootStorageDirectory(), 'summary.json'),
    );
    const { partialDatasets } = summary.metadata;

    const returnedJob = await synchronizeCollectedData(context);
    expect(returnedJob).toEqual(finalizedJob);

    const expectedRequestHeaders = getExpectedRequestHeaders();

    expect(postSpy).toHaveBeenCalledTimes(9);

    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      '/persister/synchronization/jobs',
      {
        source: 'integration-managed',
        integrationInstanceId: context.integrationInstanceId,
      },
    );

    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      { entities: expect.any(Array) },
      expectedRequestHeaders,
    );

    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/relationships`,
      { relationships: expect.any(Array) },
      expectedRequestHeaders,
    );

    expect(postSpy).toHaveBeenNthCalledWith(
      8,
      `/persister/synchronization/jobs/${job.id}/finalize`,
      {
        partialDatasets,
      },
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      9,
      `/persister/synchronization/jobs/${job.id}/finalize`,
      {
        partialDatasets,
      },
    );
  });

  test('aborts synchronization job if failure occurs during upload', async () => {
    loadProjectStructure('synchronization');

    const context = createTestContext();
    const job = generateSynchronizationJob();

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation((path: string): any => {
        if (path === `/persister/synchronization/jobs/${job.id}/finalize`) {
          throw new Error('Failed to finalize');
        }

        return {
          data: {
            job,
          },
        };
      });

    await expect(synchronizeCollectedData(context)).rejects.toThrow(
      /while finalizing synchronization job/,
    );

    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/abort`,
      {
        reason: 'Error occurred while finalizing synchronization job.',
      },
    );
  });
});

describe('uploadDataChunk', () => {
  it('should retry uploading data when a "RequestEntityTooLargeException" is returned', async () => {
    const context = createTestContext();
    const job = generateSynchronizationJob();

    const requestTooLargeError = new Error(
      'Request must be smaller than 6291456 bytes for the InvokeFunction operation',
    );
    requestTooLargeError.name = 'RequestEntityTooLargeException';
    requestTooLargeError['code'] = 'RequestEntityTooLargeException';

    const type = 'entities';
    const batch = [];

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation((path: string): any => {
        if (path === `/persister/synchronization/jobs/${job.id}/${type}`) {
          throw requestTooLargeError;
        }
        return {
          data: {
            job,
          },
        };
      });

    // don't allow shrinkBatchRawData throw error due to unshrinkable payload
    jest.spyOn(shrinkBatchRawData, 'shrinkBatchRawData').mockReturnValue();

    await expect(
      uploadDataChunk({
        logger: context.logger,
        apiClient: context.apiClient,
        jobId: job.id,
        type,
        batch,
      }),
    ).rejects.toThrow(requestTooLargeError);

    expect(postSpy).toHaveBeenCalledTimes(5);
  });

  it('should not retry uploading data when a "JOB_NOT_AWAITING_UPLOADS" is returned', async () => {
    const context = createTestContext();
    const job = generateSynchronizationJob();

    const jobNotAwaitingUploadsError = new Error('400 bad request');
    (jobNotAwaitingUploadsError as any).response = {
      data: {
        error: {
          code: 'JOB_NOT_AWAITING_UPLOADS',
          message: 'JOB_NOT_AWAITING_UPLOADS',
        },
      },
    };

    const type = 'entities';
    const batch = [];

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation((path: string): any => {
        if (path === `/persister/synchronization/jobs/${job.id}/${type}`) {
          throw jobNotAwaitingUploadsError;
        }
        return {
          data: {
            job,
          },
        };
      });

    let uploadDataChunkErr: any;

    try {
      await uploadDataChunk({
        logger: context.logger,
        apiClient: context.apiClient,
        jobId: job.id,
        type,
        batch,
      });
    } catch (err) {
      uploadDataChunkErr = err;

      expect(uploadDataChunkErr instanceof IntegrationError).toEqual(true);
      expect(uploadDataChunkErr.message).toEqual(
        'Failed to upload integration data because job has already ended',
      );
      expect(uploadDataChunkErr.code).toEqual(
        'INTEGRATION_UPLOAD_AFTER_JOB_ENDED',
      );
    }

    expect(uploadDataChunkErr).not.toBe(undefined);
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('should clean errors before throwing', async () => {
    const context = createTestContext();
    const job = generateSynchronizationJob();

    const type = 'entities';
    const batch = [];

    const mockLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    };

    jest.spyOn(context.apiClient, 'post').mockImplementation(() => {
      const err = new Error('thing went bad');
      Object.assign(err, {
        config: {
          data: 'Stuff',
          headers: {
            Authroization: 'some fake token',
            'content-type': 'application/json',
          },
        },
      });
      throw err;
    });

    await expect(
      uploadDataChunk({
        logger: mockLogger as any,
        apiClient: context.apiClient,
        jobId: job.id,
        type,
        batch,
      }),
    ).rejects.toBeInstanceOf(Error);
    const firstInfoCall = mockLogger.info.mock.calls[0];
    const args = firstInfoCall[0];
    const axiosError = args['err'];
    expect(axiosError.config.data).toBeUndefined();
    expect(axiosError.config.headers.Authorization).toBeUndefined();
  });
});

function createTestContext(
  options?: Pick<SynchronizeInput, 'source' | 'scope'>,
): SynchronizeInput {
  const apiClient = createApiClient({
    apiBaseUrl: getApiBaseUrl(),
    account: 'test-account',
    accessToken: 'fake-token',
  });

  const logger = createIntegrationLogger({
    name: 'test',
  });

  return {
    apiClient,
    logger,
    source: options?.source || 'integration-managed',
    scope: options?.scope,
    integrationInstanceId:
      options?.source == 'api' ? undefined : 'test-instance-id',
  };
}
