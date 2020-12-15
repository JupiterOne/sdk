import { IntegrationError } from '@jupiterone/integration-sdk-core';
import PQueue from 'p-queue/dist';
import { FlushedGraphObjectData } from '../storage/types';
import {
  uploadGraphObjectData,
  SynchronizationJobContext,
} from '../synchronization';

export interface StepGraphObjectDataUploader {
  enqueue: (graphObjectData: FlushedGraphObjectData) => Promise<void>;
  waitUntilUploadsComplete: () => Promise<void>;
}

export interface CreateQueuedStepGraphObjectDataUploaderParams {
  uploadConcurrency: number;
  upload: (graphObjectData: FlushedGraphObjectData) => Promise<void>;
}

export function createQueuedStepGraphObjectDataUploader({
  uploadConcurrency,
  upload,
}: CreateQueuedStepGraphObjectDataUploaderParams): StepGraphObjectDataUploader {
  const queue = new PQueue({
    concurrency: uploadConcurrency,
  });

  const uploadErrors: Error[] = [];

  return {
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
      if (queue.size >= uploadConcurrency) {
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
          message: `Error(s) uploading graph object data (errorMessages=${uploadErrors.join(
            ',',
          )})`,
        });
      }

      await queue.onIdle();
    },
  };
}

export interface CreatePersisterApiStepGraphObjectDataUploaderParams {
  synchronizationJobContext: SynchronizationJobContext;
  uploadConcurrency: number;
}

export function createPersisterApiStepGraphObjectDataUploader({
  synchronizationJobContext,
  uploadConcurrency,
}: CreatePersisterApiStepGraphObjectDataUploaderParams) {
  return createQueuedStepGraphObjectDataUploader({
    uploadConcurrency,
    upload(graphObjectData) {
      // TODO: Remove this log
      synchronizationJobContext.logger.trace('Uploading graph objects', {
        entities: graphObjectData.entities.length,
        relationships: graphObjectData.relationships.length,
      });

      return uploadGraphObjectData(synchronizationJobContext, graphObjectData);
    },
  });
}
