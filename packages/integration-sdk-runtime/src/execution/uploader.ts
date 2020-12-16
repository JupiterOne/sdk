import { IntegrationError } from '@jupiterone/integration-sdk-core';
import PQueue from 'p-queue/dist';
import { FlushedGraphObjectData } from '../storage/types';
import {
  uploadGraphObjectData,
  SynchronizationJobContext,
} from '../synchronization';

export interface StepGraphObjectDataUploader {
  stepId: string;
  enqueue: (graphObjectData: FlushedGraphObjectData) => Promise<void>;
  waitUntilUploadsComplete: () => Promise<void>;
}

export type CreateStepGraphObjectDataUploaderFunction = (
  stepId: string,
) => StepGraphObjectDataUploader;

export interface CreateQueuedStepGraphObjectDataUploaderParams {
  stepId: string;
  uploadConcurrency: number;
  upload: (graphObjectData: FlushedGraphObjectData) => Promise<void>;
  onThrottleEnqueue?: () => void;
}

export function createQueuedStepGraphObjectDataUploader({
  stepId,
  uploadConcurrency,
  upload,
  onThrottleEnqueue,
}: CreateQueuedStepGraphObjectDataUploaderParams): StepGraphObjectDataUploader {
  const queue = new PQueue({
    concurrency: uploadConcurrency,
  });

  const uploadErrors: Error[] = [];

  return {
    stepId,
    async enqueue(graphObjectData) {
      if (queue.isPaused) {
        // This step already failed an upload. We do not want to enqueue more
        // for this step.
        return;
      }

      // OPTIMIZATION: We do not want to buffer a lot of graph objects
      // into memory inside of the queue. If the queue concurrency has been
      // reached, we wait for the queue to flush so that this step has the
      // opportunity to upload more data.
      if (
        queue.pending >= uploadConcurrency ||
        queue.size >= uploadConcurrency
      ) {
        if (onThrottleEnqueue) {
          // Mainly just used for testing that our custom throttling works.
          onThrottleEnqueue();
        }

        await queue.onIdle();
      }

      queue
        .add(() => upload(graphObjectData))
        .catch((err) => {
          // Pause this queue and free up any memory on it. We do not want to
          // continue processing if there is a failure uploading for a step. This
          // step should get marked as "partial" and other steps can continue
          // to run.
          queue.pause();
          queue.clear();

          uploadErrors.push(err);
        });
    },

    async waitUntilUploadsComplete() {
      if (uploadErrors.length) {
        throw new IntegrationError({
          code: 'UPLOAD_ERROR',
          message: `Error(s) uploading graph object data (stepId=${stepId}, errorMessages=${uploadErrors.join(
            ',',
          )})`,
        });
      }

      await queue.onIdle();
    },
  };
}

export interface CreatePersisterApiStepGraphObjectDataUploaderParams {
  stepId: string;
  synchronizationJobContext: SynchronizationJobContext;
  uploadConcurrency: number;
}

export function createPersisterApiStepGraphObjectDataUploader({
  stepId,
  synchronizationJobContext,
  uploadConcurrency,
}: CreatePersisterApiStepGraphObjectDataUploaderParams) {
  return createQueuedStepGraphObjectDataUploader({
    stepId,
    uploadConcurrency,
    upload(graphObjectData) {
      return uploadGraphObjectData(synchronizationJobContext, graphObjectData);
    },
  });
}
