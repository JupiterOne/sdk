import {
  IntegrationLogger,
  UploadError,
} from '@jupiterone/integration-sdk-core';
import PQueue from 'p-queue/dist';
import { FlushedGraphObjectData } from '../storage/types';
import {
  uploadGraphObjectData,
  SynchronizationJobContext,
  DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES,
} from '../synchronization';
import { randomUUID as uuid } from 'crypto';

export interface StepGraphObjectDataUploader {
  stepId: string;
  enqueue: (graphObjectData: FlushedGraphObjectData) => Promise<void>;
  waitUntilUploadsComplete: () => Promise<void>;
}

export type CreateStepGraphObjectDataUploaderFunction = (
  stepId: string,
) => StepGraphObjectDataUploader;

export interface CreateQueuedStepGraphObjectDataUploaderParams {
  logger: IntegrationLogger;
  stepId: string;
  uploadConcurrency: number;
  upload: (graphObjectData: FlushedGraphObjectData) => Promise<void>;
  onThrottleEnqueue?: () => void;
}

export function createQueuedStepGraphObjectDataUploader({
  logger,
  stepId,
  uploadConcurrency: maximumQueueSize,
  upload,
  onThrottleEnqueue,
}: CreateQueuedStepGraphObjectDataUploaderParams): StepGraphObjectDataUploader {
  const queue = new PQueue({
    concurrency: maximumQueueSize,
  });

  let completed = false;
  const uploadErrors: Error[] = [];
  const typesInvolvedInFailures = new Set<string>();
  return {
    stepId,
    async enqueue(graphObjectData) {
      if (completed) {
        // This step has already called ran `waitUntilUploadsComplete`, so we
        // do not want to allow any additional enqueuing.
        return;
      }

      // OPTIMIZATION: We do not want to buffer a lot of graph objects
      // into memory inside of the queue. If the queue concurrency has been
      // reached, we wait for the queue to become `empty` so that this step has
      // the opportunity to upload more data.
      //
      // NOTE: Internally, `p-queue` will respect concurrency and _not_ kick off
      // a task until there is bandwidth to do so. `onEmpty` is a better choice
      // than `onIdle` in this case because we really don't care whether all
      // promises have settled, we only care that additional work is not being
      // created and subsequently kicked off.
      if (queue.size >= maximumQueueSize) {
        if (onThrottleEnqueue) {
          // Mainly just used for testing that our custom throttling works.
          onThrottleEnqueue();
        }

        await queue.onEmpty();
      }

      queue
        .add(() => upload(graphObjectData))
        .catch((err) => {
          logger.warn(
            { err, stepId, graphObjectData },
            'Error uploading graph object data batch',
          );
          // Do not pause the queue entirely. We will try to prevent additional
          // tasks from being added to the queue, but even if an error occurs,
          // we should try uploading the remaining data that we have queued up.
          // The JupiterOne synchronization should be resilient enough to handle
          // cases where this could cause an issue (e.g. a relationship getting
          // uploaded that references an entity that failed to upload).
          uploadErrors.push(err);
          if (graphObjectData) {
            graphObjectData.entities.forEach(
              (entity) => typesInvolvedInFailures.add(entity._type),
              typesInvolvedInFailures,
            );
            graphObjectData.relationships.forEach(
              (relationship) => typesInvolvedInFailures.add(relationship._type),
              typesInvolvedInFailures,
            );
          }
        });
    },

    async waitUntilUploadsComplete() {
      try {
        // Even if our `uploadErrors.length > 0` right now, we let the remaining
        // promises that were added to the queue settle before rethrowing to
        // maximize the amount of data that we are capable of actually uploading.
        await queue.onIdle();
      } finally {
        // Wait until the entire queue has settled to mark as completed. During
        // this time, we could be receiving additional tasks in our queue that
        // will grow the queue.
        completed = true;

        logger.debug(
          {
            stepId,
            uploadErrorCount: uploadErrors.length,
            typesInvolvedInFailures: Array.from(typesInvolvedInFailures),
          },
          'Upload queue processing complete',
        );
      }

      if (uploadErrors.length) {
        throw new UploadError(
          `Error(s) uploading graph object data (stepId=${stepId}, errorMessages=${uploadErrors.join(
            ',',
          )})`,
          Array.from(typesInvolvedInFailures.values()),
        );
      }
    },
  };
}

/**
 * Adding an uploadId and stepId to each log in the upload process makes it
 * easier to reason about how many graph objects are being uploaded etc.
 */
function jobContextWithUploaderMetadataLogger({
  synchronizationJobContext,
  uploadId,
  stepId,
}: {
  synchronizationJobContext: SynchronizationJobContext;
  uploadId: string;
  stepId: string;
}): SynchronizationJobContext {
  return {
    ...synchronizationJobContext,
    logger: synchronizationJobContext.logger.child({
      uploadId,
      stepId,
    }),
  };
}

export interface CreatePersisterApiStepGraphObjectDataUploaderParams {
  stepId: string;
  synchronizationJobContext: SynchronizationJobContext;
  uploadConcurrency: number;
  uploadBatchSizeInBytes?: number;
}

export function createPersisterApiStepGraphObjectDataUploader({
  stepId,
  synchronizationJobContext,
  uploadConcurrency,
  uploadBatchSizeInBytes = DEFAULT_UPLOAD_BATCH_SIZE_IN_BYTES,
}: CreatePersisterApiStepGraphObjectDataUploaderParams) {
  return createQueuedStepGraphObjectDataUploader({
    logger: synchronizationJobContext.logger,
    stepId,
    uploadConcurrency,
    async upload(graphObjectData) {
      const context = jobContextWithUploaderMetadataLogger({
        synchronizationJobContext,
        uploadId: uuid(),
        stepId: stepId,
      });

      try {
        await uploadGraphObjectData(
          context,
          graphObjectData,
          uploadBatchSizeInBytes,
        );
      } catch (err) {
        context.logger.error(
          {
            err,
            uploadConcurrency,
            uploadBatchSizeInBytes,
          },
          'Error uploading graph object data',
        );
        throw err;
      }
    },
  });
}
