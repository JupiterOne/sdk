import {
  PublishEventLevel,
  SynchronizationJob,
} from '@jupiterone/integration-sdk-core';
import { createIntegrationLogger } from '../../logger';
import { createApiClient } from '../../api';

import { createEventPublishingQueue } from '../index';
import noop from 'lodash/noop';

test('publishes integration events added to the queue in the order they were enqueued', async () => {
  const eventA = {
    name: 'a',
    description: 'Event A',
    level: PublishEventLevel.Info,
  };

  const eventB = {
    name: 'b',
    description: 'Event B',
    level: PublishEventLevel.Info,
  };

  const { apiClient, job, queue } = createContext();

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await queue.enqueue(eventA);
  await queue.enqueue(eventB);

  await queue.onIdle();

  expect(postSpy).toHaveBeenCalledTimes(2);
  expect(postSpy).toHaveBeenNthCalledWith(
    1,
    `/persister/synchronization/jobs/${job.id}/events`,
    {
      events: [
        {
          name: eventA.name,
          description: eventA.description,
        },
      ],
    },
    { headers: { 'managed-integration': 'some-integration' } },
  );

  expect(postSpy).toHaveBeenNthCalledWith(
    2,
    `/persister/synchronization/jobs/${job.id}/events`,
    {
      events: [
        {
          name: eventB.name,
          description: eventB.description,
        },
      ],
    },
    { headers: { 'managed-integration': 'some-integration' } },
  );
});

test('publishes no integration events when there is no integrationJobId', async () => {
  const { apiClient, queue } = createContext({ integrationJobId: undefined });

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await queue.enqueue({
    name: 'a',
    description: 'Event A',
    level: PublishEventLevel.Info,
  });

  await queue.onIdle();

  expect(postSpy).not.toHaveBeenCalled();
});

test('logs an error if publish fails', async () => {
  const event = {
    name: 'a',
    description: 'Event A',
    level: PublishEventLevel.Info,
  };

  const { apiClient, logger, queue } = createContext();

  const error = new Error('Failed to post event');
  Object.assign(error, {
    code: 'TEST_CODE',
    response: {
      data: {
        error: 'AN ERROR OCCURRED',
      },
    },
  });
  jest.spyOn(apiClient, 'post').mockRejectedValue(error);

  const logErrorSpy = jest.spyOn(logger, 'error');

  await queue.enqueue(event);

  await queue.onIdle();

  expect(logErrorSpy).toHaveBeenCalledTimes(1);
  expect(logErrorSpy).toHaveBeenCalledWith(
    {
      err: error,
      code: 'TEST_CODE',
      systemErrorResponseData: 'AN ERROR OCCURRED',
    },
    'Failed to publish integration event',
  );
});

function createContext(options?: Pick<SynchronizationJob, 'integrationJobId'>) {
  const apiClient = createApiClient({
    apiBaseUrl: 'https://mochi:8080',
    account: 'mochi',
  });

  const logger = createIntegrationLogger({
    name: 'test',
  });

  const job = {
    id: 'test',
    integrationJobId: 'test',
    ...options,
  } as SynchronizationJob;

  return {
    apiClient,
    logger,
    job,
    queue: createEventPublishingQueue(
      { apiClient, logger, job },
      {
        headers: { 'managed-integration': 'some-integration' },
      },
    ),
  };
}
