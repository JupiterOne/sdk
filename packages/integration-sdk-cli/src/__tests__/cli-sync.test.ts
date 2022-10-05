import { Polly } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';

import { loadProjectStructure } from '@jupiterone/integration-sdk-private-test-utils';
import { SynchronizationJobStatus } from '@jupiterone/integration-sdk-core';

import { createCli } from '../index';

import {
  generateSynchronizationJob,
  setupSynchronizerApi,
} from './util/synchronization';

import * as log from '../log';
import { createTestPolly } from './util/recording';

jest.mock('../log');

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

let polly: Polly;

beforeEach(() => {
  process.env.JUPITERONE_API_KEY = 'testing-key';
  process.env.JUPITERONE_ACCOUNT = 'mochi';

  polly = createTestPolly('sync-cli');
  loadProjectStructure('synchronization');

  jest.spyOn(process, 'exit').mockImplementation((code: number | undefined) => {
    throw new Error(`Process exited with code ${code}`);
  });
});

afterEach(() => {
  delete process.env.JUPITERONE_API_KEY;
  delete process.env.JUPITERONE_DEV;
  polly.disconnect();
});

test('uploads data to the synchronization api and displays the results', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--integrationInstanceId',
    'test',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledWith({
    ...job,
    status: SynchronizationJobStatus.FINALIZE_PENDING,
    // We arrive at these numbers because of what
    // was written to disk in the 'synchronization' project fixture
    numEntitiesUploaded: 6,
    numRelationshipsUploaded: 3,
  });
});

test('skips finalization with skip-finalize', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--integrationInstanceId',
    'test',
    '--skip-finalize',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledWith({
    ...job,
    status: SynchronizationJobStatus.AWAITING_UPLOADS,
    // We arrive at these numbers because of what
    // was written to disk in the 'synchronization' project fixture
    numEntitiesUploaded: 6,
    numRelationshipsUploaded: 3,
  });
});

test('does not publish events for source "api" since there is no integrationJobId', async () => {
  const job = generateSynchronizationJob({ source: 'api', scope: 'test' });

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.us.jupiterone.io',
  });

  let eventsPublished = false;
  polly.server
    .post(`https://example.com/persister/synchronization/jobs/${job.id}/events`)
    .intercept((req, res) => {
      eventsPublished = true;
    });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--source',
    'api',
    '--scope',
    'test',
  ]);

  expect(eventsPublished).toBe(false);
  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
});
