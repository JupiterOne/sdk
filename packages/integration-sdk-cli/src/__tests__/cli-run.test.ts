import { Polly } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';

import { createCli } from '../index';
import { loadProjectStructure } from '@jupiterone/integration-sdk-private-test-utils';

import {
  generateSynchronizationJob,
  setupSynchronizerApi,
} from './util/synchronization';

import {
  StepResultStatus,
  SynchronizationJobStatus,
} from '@jupiterone/integration-sdk-core';

import * as log from '../log';
import { createTestPolly } from './util/recording';

jest.mock('../log');

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

let polly: Polly;

beforeEach(() => {
  process.env.JUPITERONE_API_KEY = 'testing-key';
  process.env.JUPITERONE_ACCOUNT = 'mochi';

  polly = createTestPolly('run-cli');
  loadProjectStructure('typeScriptIntegrationProject');

  jest.spyOn(process, 'exit').mockImplementation((code: number | undefined) => {
    throw new Error(`Process exited with code ${code}`);
  });
});

afterEach(() => {
  delete process.env.JUPITERONE_API_KEY;
  delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
  polly.disconnect();
});

test('enables graph object schema validation', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
  ]);

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
});

test('disables graph object schema validation', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--disable-schema-validation',
  ]);

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();
});

test('executes integration and performs upload', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({ polly, job, baseUrl: 'https://api.us.jupiterone.io' });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);

  expect(log.displayExecutionResults).toHaveBeenCalledWith({
    integrationStepResults: [
      {
        id: 'fetch-accounts',
        name: 'Fetch Accounts',
        declaredTypes: ['my_account'],
        partialTypes: [],
        encounteredTypes: ['my_account'],
        status: StepResultStatus.SUCCESS,
      },
      {
        id: 'fetch-users',
        name: 'Fetch Users',
        declaredTypes: ['my_user', 'my_account_has_user'],
        partialTypes: [],
        encounteredTypes: ['my_user', 'my_account_has_user'],
        status: StepResultStatus.SUCCESS,
      },
    ],
    metadata: {
      partialDatasets: {
        types: [],
      },
    },
  });

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledWith({
    ...job,
    status: SynchronizationJobStatus.FINALIZE_PENDING,
    // These are the expected number of entities and relationships
    // collected when executing the
    // 'typeScriptIntegrationProject' fixture
    numEntitiesUploaded: 2,
    numRelationshipsUploaded: 1,
  });
});

test('executes integration and performs upload with api-base-url', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.TEST.jupiterone.io',
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--api-base-url',
    'https://api.TEST.jupiterone.io',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);

  expect(log.displayExecutionResults).toHaveBeenCalledWith({
    integrationStepResults: [
      {
        id: 'fetch-accounts',
        name: 'Fetch Accounts',
        declaredTypes: ['my_account'],
        partialTypes: [],
        encounteredTypes: ['my_account'],
        status: StepResultStatus.SUCCESS,
      },
      {
        id: 'fetch-users',
        name: 'Fetch Users',
        declaredTypes: ['my_user', 'my_account_has_user'],
        partialTypes: [],
        encounteredTypes: ['my_user', 'my_account_has_user'],
        status: StepResultStatus.SUCCESS,
      },
    ],
    metadata: {
      partialDatasets: {
        types: [],
      },
    },
  });

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledWith({
    ...job,
    status: SynchronizationJobStatus.FINALIZE_PENDING,
    // These are the expected number of entities and relationships
    // collected when executing the
    // 'typeScriptIntegrationProject' fixture
    numEntitiesUploaded: 2,
    numRelationshipsUploaded: 1,
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
