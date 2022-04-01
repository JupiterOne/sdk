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

jest.mock('../log');

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

let polly: Polly;

beforeEach(() => {
  process.env.JUPITERONE_API_KEY = 'testing-key';
  process.env.JUPITERONE_ACCOUNT = 'mochi';

  polly = new Polly('sync-cli', {
    adapters: ['node-http'],
    persister: 'fs',
    logging: false,
    matchRequestsBy: {
      headers: false,
    },
  });

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

test('hits dev urls if JUPITERONE_DEV environment variable is set', async () => {
  process.env.JUPITERONE_DEV = 'true';

  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.dev.jupiterone.io',
  });

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

test('hits different url if --api-base-url is set', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.TEST.jupiterone.io',
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'sync',
    '--integrationInstanceId',
    'test',
    '--api-base-url',
    'https://api.TEST.jupiterone.io',
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

test('throws an error if --api-base-url is set with --development', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.TEST.jupiterone.io',
  });

  await expect(
    createCli().parseAsync([
      'node',
      'j1-integration',
      'sync',
      '--integrationInstanceId',
      'test',
      '--development',
      '--api-base-url',
      'https://api.TEST.jupiterone.io',
    ]),
  ).rejects.toThrow(
    'Invalid configuration supplied.  Cannot specify both --api-base-url and --development(-d) flags.',
  );
});

test('throws if JUPITERONE_API_KEY is not set', async () => {
  delete process.env.JUPITERONE_API_KEY;

  await expect(
    createCli().parseAsync([
      'node',
      'j1-integration',
      'sync',
      '--integrationInstanceId',
      'test',
    ]),
  ).rejects.toThrow('JUPITERONE_API_KEY environment variable must be set');
});
