import { FlushedGraphObjectData } from '../storage/types';
import {
  createPersisterApiStepGraphObjectDataUploader,
  createQueuedStepGraphObjectDataUploader,
  StepGraphObjectDataUploader,
} from './uploader';
import {
  sleep,
  createTestEntity,
  createTestRelationship,
} from '@jupiterone/integration-sdk-private-test-utils';
import times from 'lodash/times';
import { v4 as uuid } from 'uuid';
import { SynchronizationJobContext } from '../synchronization';
import { createApiClient, getApiBaseUrl } from '../api';
import { generateSynchronizationJob } from '../synchronization/__tests__/util/generateSynchronizationJob';
import { createMockIntegrationLogger } from '../../test/util/fixtures';

function createFlushedGraphObjectData(): FlushedGraphObjectData {
  return {
    entities: [createTestEntity(), createTestEntity()],
    relationships: [createTestRelationship(), createTestRelationship()],
    mappedRelationships: [],
  };
}

async function createAndEnqueueUploads(
  uploader: StepGraphObjectDataUploader,
  n: number,
) {
  const flushed = times(n, createFlushedGraphObjectData);

  for (const data of flushed) {
    await uploader.enqueue(data);
  }

  return flushed;
}

async function createFlushedDataAndWaitForUploads(
  uploader: StepGraphObjectDataUploader,
  n: number,
) {
  const flushed = await createAndEnqueueUploads(uploader, n);
  await uploader.waitUntilUploadsComplete();
  return flushed;
}

describe('#createQueuedStepGraphObjectDataUploader', () => {
  test('should wait for all enqueued uploads to complete', async () => {
    const uploaded: FlushedGraphObjectData[] = [];
    let numQueued = 0;

    const uploader = createQueuedStepGraphObjectDataUploader({
      stepId: uuid(),
      uploadConcurrency: Infinity,
      async upload(d) {
        if (numQueued) {
          await sleep(100);
          uploaded.push(d);
        } else {
          numQueued++;
          await sleep(200);
          uploaded.push(d);
        }

        numQueued++;
      },
    });

    const flushed = await createFlushedDataAndWaitForUploads(uploader, 2);
    expect(uploaded).toEqual(flushed.reverse());
  });

  test('should throttle enqueuing if concurrency threshold hit', async () => {
    const uploaded: FlushedGraphObjectData[] = [];
    let throttleCount = 0;

    const uploader = createQueuedStepGraphObjectDataUploader({
      stepId: uuid(),
      uploadConcurrency: 2,
      async upload(d) {
        await sleep(300);
        uploaded.push(d);
      },
      onThrottleEnqueue() {
        throttleCount++;
      },
    });

    const flushed = await createFlushedDataAndWaitForUploads(uploader, 6);
    expect(uploaded).toEqual(flushed);
    expect(throttleCount).toEqual(1);
  });

  test('should allow enqueue after a failure', async () => {
    const uploaded: FlushedGraphObjectData[] = [];
    const stepId = uuid();
    const expectedErrorMessage = `Error(s) uploading graph object data (stepId=${stepId}, errorMessages=Error: expected upload error)`;

    let numQueued = 0;

    const uploader = createQueuedStepGraphObjectDataUploader({
      stepId,
      uploadConcurrency: 2,
      async upload(d) {
        numQueued++;

        if (numQueued === 2) {
          await sleep(100);
          throw new Error('expected upload error');
        } else {
          await sleep(200);
          uploaded.push(d);
        }
      },
    });

    const flushed = await createAndEnqueueUploads(uploader, 3);

    // Ensure that the next enqueue happens _after_ a failure has occurred.
    await sleep(300);
    const flushedAfterFailure = createFlushedGraphObjectData();
    await uploader.enqueue(flushedAfterFailure);

    await expect(uploader.waitUntilUploadsComplete()).rejects.toThrowError(
      expectedErrorMessage,
    );

    // This should _not_ be actually processed by our queue. After the
    // `waitUntilUploadsComplete` promise has settled, we do not allow additional
    // tasks to be added to the queue.
    const flushedAfterCompleted = createFlushedGraphObjectData();
    await uploader.enqueue(flushedAfterCompleted);

    expect(uploaded).toEqual([flushed[0], flushed[2], flushedAfterFailure]);
  });
});

describe('#createPersisterApiStepGraphObjectDataUploader', () => {
  test('should upload to persister API', async () => {
    const accountId = uuid();

    const apiClient = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: accountId,
    });

    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({});

    const job = generateSynchronizationJob();
    const synchronizationJobContext: SynchronizationJobContext = {
      logger: createMockIntegrationLogger(),
      apiClient,
      job,
    };

    const uploader = createPersisterApiStepGraphObjectDataUploader({
      synchronizationJobContext,
      stepId: uuid(),
      uploadConcurrency: 2,
    });

    const flushed = await createFlushedDataAndWaitForUploads(uploader, 3);
    expect(postSpy).toHaveBeenCalledTimes(6);

    for (const { entities, relationships } of flushed) {
      expect(postSpy).toHaveBeenCalledWith(
        `/persister/synchronization/jobs/${job.id}/entities`,
        {
          entities,
        },
      );

      expect(postSpy).toHaveBeenCalledWith(
        `/persister/synchronization/jobs/${job.id}/relationships`,
        {
          relationships,
        },
      );
    }
  });
});
