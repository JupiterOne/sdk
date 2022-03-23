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
  initiateSynchronization,
  uploadCollectedData,
  finalizeSynchronization,
  synchronizeCollectedData,
  abortSynchronization,
  uploadDataChunk,
  shrinkRawData,
} from '../index';

import { getApiBaseUrl, createApiClient } from '../../api';
import { ExecuteIntegrationResult } from '../../execution';
import { createIntegrationLogger } from '../../logger';

import { getRootStorageDirectory, readJsonFromPath } from '../../fileSystem';
import { generateSynchronizationJob } from './util/generateSynchronizationJob';

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

    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/entities`,
      { entities: expect.any(Array) },
    );

    expect(postSpy).toHaveBeenCalledWith(
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
});

describe('shrinkLargeUpload', () => {
  it('should shrink rawData', () => {
    const context = createTestContext();

    const largeData = new Array(700000).join('aaaaaaaaaa');

    const data = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
        _rawData: [
          {
            name: 'test',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: largeData,
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: largeData,
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey3',
        _type: 'testType',
        _rawData: [
          {
            name: 'test3',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: largeData,
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];
    const finalData = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
        _rawData: [
          {
            name: 'test',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: 'TRUNCATED',
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: 'TRUNCATED',
              testFinalData: 'test789',
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey3',
        _type: 'testType',
        _rawData: [
          {
            name: 'test3',
            rawData: {
              testRawData: 'test123',
              testLargeRawData: 'TRUNCATED',
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];

    shrinkRawData(data, context.logger);

    expect(data).toEqual(finalData);
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
