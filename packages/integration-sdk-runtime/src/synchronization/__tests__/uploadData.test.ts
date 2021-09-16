import times from 'lodash/times';
import noop from 'lodash/noop';

import {
  createIntegrationEntity,
  createMappedRelationship,
  Entity,
  MappedRelationship,
  Relationship,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';
import { generateSynchronizationJob } from './util/generateSynchronizationJob';

import { getApiBaseUrl, createApiClient } from '../../api';
import { createIntegrationLogger } from '../../logger';

import { uploadData, uploadGraphObjectData } from '../index';

test('uploads entity data in batches of 250', async () => {
  const { job, logger, apiClient } = createTestContext();

  const data = times(
    510,
    (i): Entity => ({
      _key: `entity:${i}`,
      _type: 'resource',
      _class: 'Resource',
    }),
  );

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'entities',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(3);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(0, 250),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(250, 500),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(500, 510),
    },
  );
});

test('uploads relationship data in batches of 250', async () => {
  const { job, logger, apiClient } = createTestContext();

  const data = times(
    510,
    (i): Relationship => ({
      _key: `relationship:${i}`,
      _type: 'resource',
      _class: 'Resource',
      _fromEntityKey: `entity:${i}`,
      _toEntityKey: `entity:${i + 1}`,
    }),
  );

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'relationships',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(3);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/relationships`,
    {
      relationships: data.slice(0, 250),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/relationships`,
    {
      relationships: data.slice(250, 500),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/relationships`,
    {
      relationships: data.slice(500, 510),
    },
  );
});

test('uploads mapped relationship data in batches of 250', async () => {
  const { job, logger, apiClient } = createTestContext();

  const data = times(
    510,
    (i): MappedRelationship =>
      createMappedRelationship({
        _class: RelationshipClass.HAS,
        _type: 'relationship_resource',
        _key: `mapped-relationship:${i}`,
        source: createIntegrationEntity({
          entityData: {
            source: {},
            assign: {
              _class: 'Resource',
              _type: 'entity_resource',
              _key: `entity:${i}`,
            },
          },
        }),
        target: {
          _type: 'entity_resource',
          _key: `entity:${i + 1}`,
        },
      }),
  );

  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'mappedRelationships',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(3);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/mappedRelationships`,
    {
      mappedRelationships: data.slice(0, 250),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/mappedRelationships`,
    {
      mappedRelationships: data.slice(250, 500),
    },
  );
  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/mappedRelationships`,
    {
      mappedRelationships: data.slice(500, 510),
    },
  );
});

test('should retry a failed upload', async () => {
  const { job, logger, apiClient } = createTestContext();

  const loggerWarnSpy = jest.spyOn(logger, 'warn');

  const data = times(
    510,
    (i): Entity => ({
      _key: `entity:${i}`,
      _type: 'resource',
      _class: 'Resource',
    }),
  );

  const expectedError = new Error('expected error');

  const postSpy = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValueOnce(expectedError)
    .mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'entities',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(4);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(0, 250),
    },
  );

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(250, 500),
    },
  );

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(500, 510),
    },
  );

  expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
  expect(loggerWarnSpy).toHaveBeenCalledWith(
    {
      attemptNum: 0,
      err: expectedError,
    },
    'Failed to upload integration data chunk (will retry)',
  );
});

test('should retry a failed upload and not log warn when error is a "CredentialsError"', async () => {
  const { job, logger, apiClient } = createTestContext();

  const loggerWarnSpy = jest.spyOn(logger, 'warn');

  const data = times(
    510,
    (i): Entity => ({
      _key: `entity:${i}`,
      _type: 'resource',
      _class: 'Resource',
    }),
  );

  const expectedError = new Error('expected error');
  (expectedError as any).code = 'CredentialsError';

  const postSpy = jest
    .spyOn(apiClient, 'post')
    .mockRejectedValueOnce(expectedError)
    .mockImplementation(noop as any);

  await uploadData(
    {
      job,
      logger,
      apiClient,
    },
    'entities',
    data,
  );

  expect(postSpy).toHaveBeenCalledTimes(4);

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(0, 250),
    },
  );

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(250, 500),
    },
  );

  expect(postSpy).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${job.id}/entities`,
    {
      entities: data.slice(500, 510),
    },
  );

  expect(loggerWarnSpy).toHaveBeenCalledTimes(0);
});

test('should not upload with empty graph object arrays', async () => {
  const { job, logger, apiClient } = createTestContext();
  const postSpy = jest.spyOn(apiClient, 'post').mockImplementation(noop as any);

  await uploadGraphObjectData(
    {
      job,
      logger,
      apiClient,
    },
    {
      entities: [],
      relationships: [],
      mappedRelationships: [],
    },
  );

  expect(postSpy).toHaveBeenCalledTimes(0);
});

function createTestContext() {
  const job = generateSynchronizationJob();

  const logger = createIntegrationLogger({
    name: 'test',
  });

  const apiClient = createApiClient({
    apiBaseUrl: getApiBaseUrl(),
    account: 'test-account',
  });

  return { job, logger, apiClient };
}
