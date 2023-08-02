import { IntegrationEvent } from '@jupiterone/integration-sdk-core';
import { AxiosRequestConfig } from 'axios';
import PromiseQueue from 'p-queue';

import {
  getSystemErrorResponseData,
  SynchronizationJobContext,
} from '../synchronization';

type EventPublishingQueue = {
  enqueue: (event: IntegrationEvent) => void;
  onIdle: () => Promise<void>;
};

export const createEventPublishingQueue = (
  { apiClient, logger, job }: SynchronizationJobContext,
  config?: AxiosRequestConfig,
): EventPublishingQueue => {
  if (!job.integrationJobId) return createNoopEventPublishingQueue();

  const queue = new PromiseQueue({ concurrency: 1 });

  return {
    enqueue(event: IntegrationEvent) {
      void queue.add(async () => {
        try {
          await apiClient.post(
            `/persister/synchronization/jobs/${job.id}/events`,
            {
              events: [
                {
                  name: event.name,
                  description: event.description,
                  // level: event.level, // TODO enable the `level` property in synchronization API
                },
              ],
            },
            config,
          );
        } catch (err) {
          const systemErrorResponseData = getSystemErrorResponseData(err);
          logger.error(
            { err, code: err.code, systemErrorResponseData },
            'Failed to publish integration event',
          );
        }
      });
    },
    onIdle: async () => queue.onIdle(),
  };
};

/**
 * Creates a no-op queue for use when there is no integrationJobId for publishing events.
 */
function createNoopEventPublishingQueue(): EventPublishingQueue {
  return {
    enqueue(_event) {
      // noop
    },
    async onIdle() {
      return Promise.resolve();
    },
  };
}
