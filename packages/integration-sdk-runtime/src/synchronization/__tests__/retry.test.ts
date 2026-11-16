import { generateSynchronizationJob } from './util/generateSynchronizationJob';

import { ApiResponseError, createApiClient, getApiBaseUrl } from '../../api';
import { createIntegrationLogger } from '../../logger';
import { retryCalls } from '../../../test/util/attemptWithoutDelays';
import * as shrinkBatchRawData from '../shrinkBatchRawData';

import {
  calculateSynchronizationRetryDelay,
  finalizeSynchronization,
  SYNCHRONIZATION_RETRY_OPTIONS,
  uploadDataChunk,
} from '../index';

jest.mock('@lifeomic/attempt', () =>
  require('../../../test/util/attemptWithoutDelays'),
);

const { defaultCalculateDelay } = jest.requireActual('@lifeomic/attempt');

beforeEach(() => {
  retryCalls.length = 0;
});

afterEach(() => {
  jest.restoreAllMocks();
});

function createTestContext() {
  return {
    job: generateSynchronizationJob(),
    logger: createIntegrationLogger({ name: 'test' }),
    apiClient: createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: 'test-account',
      accessToken: 'fake-token',
    }),
  };
}

const partialDatasets = { types: [] };

function responseError(status: number) {
  return new ApiResponseError('POST', 'https://example.test/x', status, '', {});
}

describe('SYNCHRONIZATION_RETRY_OPTIONS', () => {
  test('makes 5 attempts, waiting 1s, 2s, 4s and 8s between them', () => {
    const { maxAttempts } = SYNCHRONIZATION_RETRY_OPTIONS;
    expect(maxAttempts).toBe(5);

    const waits: number[] = [];
    for (let attemptNum = 1; attemptNum < maxAttempts; attemptNum++) {
      waits.push(
        defaultCalculateDelay(
          { attemptNum, attemptsRemaining: maxAttempts - attemptNum },
          { minDelay: 0, jitter: false, ...SYNCHRONIZATION_RETRY_OPTIONS },
        ),
      );
    }

    expect(waits).toEqual([1000, 2000, 4000, 8000]);
  });

  test('uses the randomized delay', () => {
    expect(SYNCHRONIZATION_RETRY_OPTIONS.calculateDelay).toBe(
      calculateSynchronizationRetryDelay,
    );
  });
});

describe('calculateSynchronizationRetryDelay', () => {
  const options = {
    minDelay: 0,
    jitter: false,
    ...SYNCHRONIZATION_RETRY_OPTIONS,
  } as any;

  function waits() {
    const { maxAttempts } = SYNCHRONIZATION_RETRY_OPTIONS;
    const result: number[] = [];
    for (let attemptNum = 1; attemptNum < maxAttempts; attemptNum++) {
      result.push(
        calculateSynchronizationRetryDelay(
          {
            attemptNum,
            attemptsRemaining: maxAttempts - attemptNum,
          } as any,
          options,
        ),
      );
    }
    return result;
  }

  test('does not wait before the first attempt', () => {
    // `retry` calls calculateDelay with attemptNum 0 before the first attempt.
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(
      calculateSynchronizationRetryDelay(
        { attemptNum: 0, attemptsRemaining: 5 } as any,
        options,
      ),
    ).toBe(0);
  });

  test('waits at least 0.75 times the base delay', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(waits()).toEqual([750, 1500, 3000, 6000]);
  });

  test('waits at most 1.25 times the base delay', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1);
    expect(waits()).toEqual([1250, 2500, 5000, 10000]);
  });

  test('waits the base delay at the middle of the range', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(waits()).toEqual([1000, 2000, 4000, 8000]);
  });
});

describe('uploadDataChunk', () => {
  test('retries with the synchronization retry schedule', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(responseError(503))
      .mockRejectedValueOnce(responseError(503))
      .mockResolvedValue({ data: {} });

    await uploadDataChunk({
      logger,
      apiClient,
      jobId: job.id,
      type: 'entities',
      batch: [],
    });

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(retryCalls).toHaveLength(1);
    expect(retryCalls[0]).toMatchObject(SYNCHRONIZATION_RETRY_OPTIONS);
  });

  // Every response is retried, 4xx included: ingestion-service answers 400
  // when storing the upload fails and 401 when its authorizer fails, and both
  // can pass on a later attempt.
  test.each([400, 401, 403, 404, 408, 429, 500, 503])(
    'retries a %d response',
    async (status) => {
      const { job, logger, apiClient } = createTestContext();

      const postSpy = jest
        .spyOn(apiClient, 'post')
        .mockRejectedValueOnce(responseError(status))
        .mockResolvedValue({ data: {} });

      await uploadDataChunk({
        logger,
        apiClient,
        jobId: job.id,
        type: 'entities',
        batch: [],
      });

      expect(postSpy).toHaveBeenCalledTimes(2);
    },
  );

  test('shrinks the batch and retries a 413 response', async () => {
    const { job, logger, apiClient } = createTestContext();
    const shrinkSpy = jest
      .spyOn(shrinkBatchRawData, 'shrinkBatchRawData')
      .mockReturnValue();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(responseError(413))
      .mockResolvedValue({ data: {} });

    await uploadDataChunk({
      logger,
      apiClient,
      jobId: job.id,
      type: 'entities',
      batch: [],
    });

    expect(shrinkSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  test('retries an error without a response, such as a network error', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(new Error('other side closed'))
      .mockResolvedValue({ data: {} });

    await uploadDataChunk({
      logger,
      apiClient,
      jobId: job.id,
      type: 'entities',
      batch: [],
    });

    expect(postSpy).toHaveBeenCalledTimes(2);
  });
});

describe('finalizeSynchronization', () => {
  test('retries a failed finalize and returns the job once it succeeds', async () => {
    const { job, logger, apiClient } = createTestContext();
    const warnSpy = jest.spyOn(logger, 'warn');

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(responseError(503))
      .mockRejectedValueOnce(new Error('other side closed'))
      .mockResolvedValue({ data: { job } });

    await expect(
      finalizeSynchronization({ apiClient, logger, job, partialDatasets }),
    ).resolves.toEqual(job);

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ attemptNum: 0, attemptsRemaining: 4 }),
      'Error occurred while finalizing synchronization job. Retrying request.',
    );
  });

  test('uses the synchronization retry schedule and turns off the client retry', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { job } });

    await finalizeSynchronization({ apiClient, logger, job, partialDatasets });

    expect(retryCalls).toHaveLength(1);
    expect(retryCalls[0]).toMatchObject(SYNCHRONIZATION_RETRY_OPTIONS);
    expect(postSpy).toHaveBeenCalledWith(
      `/persister/synchronization/jobs/${job.id}/finalize`,
      { partialDatasets },
      { retry: false },
    );
  });

  test('gives up after 5 failed attempts', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(responseError(503));

    await expect(
      finalizeSynchronization({ apiClient, logger, job, partialDatasets }),
    ).rejects.toThrow(/while finalizing synchronization job/);

    expect(postSpy).toHaveBeenCalledTimes(5);
  });

  test('retries a 429 response', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(responseError(429))
      .mockResolvedValue({ data: { job } });

    await finalizeSynchronization({ apiClient, logger, job, partialDatasets });

    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  test('does not post finalize again when a successful response has no body', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: undefined } as any);

    await expect(
      finalizeSynchronization({ apiClient, logger, job, partialDatasets }),
    ).rejects.toThrow(/while finalizing synchronization job/);

    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  test('does not retry a response the server will not change, such as a 400', async () => {
    const { job, logger, apiClient } = createTestContext();

    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(responseError(400));

    await expect(
      finalizeSynchronization({ apiClient, logger, job, partialDatasets }),
    ).rejects.toThrow(/while finalizing synchronization job/);

    expect(postSpy).toHaveBeenCalledTimes(1);
  });
});
