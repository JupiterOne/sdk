import { IntegrationEvent } from '@jupiterone/integration-sdk-core';
import { AxiosRequestConfig } from 'axios';
import PromiseQueue from 'p-queue';

import { SynchronizationJobContext } from '../synchronization';

export const createEventPublishingQueue = (
  { apiClient, logger, job }: SynchronizationJobContext,
  config?: AxiosRequestConfig,
) => {
  const queue = new PromiseQueue({ concurrency: 1 });

  return {
    enqueue(event: IntegrationEvent) {
      return queue.add(async () => {
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
          logger.error({ err }, 'Failed to publish integration event');
        }
      });
    },
    onIdle: () => queue.onIdle(),
  };
};
