import { loadProjectStructure } from '@jupiterone/integration-sdk-private-test-utils';
import { SynchronizationJobStatus } from '@jupiterone/integration-sdk-core';

import { createCli } from '../index';

import {
  generateSynchronizationJob,
  startSynchronizerApi,
  SynchronizerApi,
} from './util/synchronization';

import * as log from '../log';

jest.mock('../log');

let api: SynchronizerApi | undefined;

beforeEach(() => {
  process.env.JUPITERONE_API_KEY = 'testing-key';
  process.env.JUPITERONE_ACCOUNT = 'mochi';

  loadProjectStructure('synchronization');

  jest.spyOn(process, 'exit').mockImplementation((code: number | undefined) => {
    throw new Error(`Process exited with code ${code}`);
  });
});

afterEach(async () => {
  delete process.env.JUPITERONE_API_KEY;
  delete process.env.JUPITERONE_DEV;
  await api?.close();
  api = undefined;
});

test('uploads data to the synchronization api and displays the results', async () => {
  const job = generateSynchronizationJob();
  api = await startSynchronizerApi({ job });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--integrationInstanceId',
    'test',
    '--api-base-url',
    api.baseUrl,
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
  api = await startSynchronizerApi({ job });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--integrationInstanceId',
    'test',
    '--skip-finalize',
    '--api-base-url',
    api.baseUrl,
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
  api = await startSynchronizerApi({ job });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--source',
    'api',
    '--scope',
    'test',
    '--api-base-url',
    api.baseUrl,
  ]);

  expect(api.eventsPublished).toBe(false);
  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
});
