import { generateSynchronizationJob } from './util/generateSynchronizationJob';

import { ApiResponseError, createApiClient, getApiBaseUrl } from '../../api';
import { createIntegrationLogger } from '../../logger';
import { retryCalls } from '../../../test/util/attemptWithoutDelays';

import {
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
