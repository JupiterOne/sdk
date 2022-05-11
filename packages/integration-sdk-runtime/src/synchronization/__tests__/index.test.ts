import path from 'path';
import times from 'lodash/times';
import noop from 'lodash/noop';

import {
  IntegrationError,
  IntegrationErrorEventName,
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
  shrinkBatchRawData,
} from '../index';

import { getApiBaseUrl, createApiClient } from '../../api';
import { ExecuteIntegrationResult } from '../../execution';
import { createIntegrationLogger } from '../../logger';

import { getRootStorageDirectory, readJsonFromPath } from '../../fileSystem';
import { generateSynchronizationJob } from './util/generateSynchronizationJob';
import { getExpectedRequestHeaders } from '../../../test/util/request';

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

    const expectedRequestHeaders = getExpectedRequestHeaders();

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

describe('shrinkBatchRawData', () => {
  const logger = createIntegrationLogger({
    name: 'test',
  });
  logger.error = jest.fn();
  logger.publishErrorEvent = jest.fn();
  logger.info = jest.fn();

  afterEach(() => {
    delete process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
    restoreProjectStructure();
    jest.clearAllMocks();
  });

  it('should shrink rawData until batch size is < 6 million bytes', () => {
    const largeData = new Array(500000).join('aaaaaaaaaa');
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
              willGetRemovedFirst:
                'yes it will get removed first b/c it has largest raw data',
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
              willGetRemovedSecond: true,
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
    const startingSize = Buffer.byteLength(JSON.stringify(data));
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
              willGetRemovedFirst:
                'yes it will get removed first b/c it has largest raw data',
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
              willGetRemovedSecond: true,
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
              testLargeRawData: expect.stringContaining('aaaaaaa'),
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];

    shrinkBatchRawData(data, logger);
    expect(logger.info).toBeCalledTimes(2);
    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Attempting to shrink rawData',
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        initialSize: startingSize,
        totalSize: Buffer.byteLength(JSON.stringify(data)),
        itemsRemoved: 2,
      }),
      'Shrink raw data result',
    );
    expect(data).toEqual(finalData);
  });
  it('should detect if data is unshrinkable and throw error', () => {
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
              largeRawDataProp: largeData + 'more',
              testRawData: 'test123',
              testFinalData: 'test789',
              anotherLargeRawDataProp: largeData,
            },
          },
        ],
      },
      {
        _class: 'test',
        _key: 'testKey2',
        _type: 'testType',
        // poison pill in entity properties
        largeProperty: largeData,
        _rawData: [
          {
            name: 'test2',
            rawData: {
              testRawData: 'test123',
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
              testFinalData: 'test789',
            },
          },
        ],
      },
    ];
    try {
      shrinkBatchRawData(data, logger);
      throw new Error('this was not supposed to happen');
    } catch (err) {
      expect(err).toBeInstanceOf(IntegrationError);
      expect(logger.error).toBeCalledTimes(1);
      // should give details on largest entity in batch after finished shrinking, this should be item with _key=testKey3
      expect(logger.error).toBeCalledWith(
        expect.objectContaining({
          largestEntityPropSizeMap: {
            _class: 6,
            _key: 10,
            _rawData: 80,
            _type: 10,
            largeProperty: 6999992,
          },
        }),
        expect.stringContaining(
          'Encountered upload size error after fully shrinking.',
        ),
      );
      expect(logger.publishErrorEvent).toBeCalledTimes(1);
      expect(logger.publishErrorEvent).toBeCalledWith(
        expect.objectContaining({
          name: IntegrationErrorEventName.EntitySizeLimitEncountered,
        }),
      );
      expect(logger.info).toBeCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
    }
  });
  it('should fail to shrink rawData due to no entities', () => {
    const data = [];
    let shrinkErr;
    try {
      shrinkBatchRawData(data, logger, 0);
    } catch (err) {
      shrinkErr = err;
      expect(shrinkErr instanceof IntegrationError).toEqual(true);
      expect(shrinkErr.message).toEqual(
        'Failed to upload integration data because payload is too large and cannot shrink',
      );
      expect(shrinkErr.code).toEqual('INTEGRATION_UPLOAD_FAILED');
    }
    expect(shrinkErr).not.toBe(undefined);
    expect(logger.info).toBeCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
  });
  it('should fail to shrink rawData due to no _rawData entries', () => {
    const data = [
      {
        _class: 'test',
        _key: 'testKey',
        _type: 'testType',
      },
    ];
    let shrinkErr;
    try {
      shrinkBatchRawData(data, logger, 0);
    } catch (err) {
      shrinkErr = err;
      expect(shrinkErr instanceof IntegrationError).toEqual(true);
      expect(shrinkErr.message).toEqual(
        'Failed to upload integration data because payload is too large and cannot shrink',
      );
      expect(shrinkErr.code).toEqual('INTEGRATION_UPLOAD_FAILED');
    }
    expect(shrinkErr).not.toBe(undefined);
    expect(logger.info).toBeCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith('Attempting to shrink rawData');
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
