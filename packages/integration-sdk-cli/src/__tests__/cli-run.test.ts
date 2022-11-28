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

test('step should fail if enableSchemaValidation = true', async () => {
  loadProjectStructure('instanceWithNonValidatingSteps');
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.us.jupiterone.io',
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);

  expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
  expect(log.displayExecutionResults).toHaveBeenCalledWith({
    integrationStepResults: [
      {
        id: 'fetch-users',
        name: 'Fetch Users',
        declaredTypes: ['my_user'],
        partialTypes: [],
        encounteredTypes: [],
        status: StepResultStatus.FAILURE,
      },
    ],
    metadata: {
      partialDatasets: {
        types: ['my_user'],
      },
    },
  });
});

test('step should pass if enableSchemaValidation = false', async () => {
  loadProjectStructure('instanceWithNonValidatingSteps');
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.us.jupiterone.io',
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--disable-schema-validation',
  ]);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);

  expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
  expect(log.displayExecutionResults).toHaveBeenCalledWith({
    integrationStepResults: [
      {
        id: 'fetch-users',
        name: 'Fetch Users',
        declaredTypes: ['my_user'],
        partialTypes: [],
        encounteredTypes: ['my_user'],
        status: StepResultStatus.SUCCESS,
      },
    ],
    metadata: {
      partialDatasets: {
        types: [],
      },
    },
  });
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

  expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
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

test('executes integration and skips finalization with skip-finalize', async () => {
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.us.jupiterone.io',
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--skip-finalize',
  ]);

  expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);

  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledWith({
    ...job,
    status: SynchronizationJobStatus.AWAITING_UPLOADS,
    // These are the expected number of entities and relationships
    // collected when executing the
    // 'typeScriptIntegrationProject' fixture
    numEntitiesUploaded: 2,
    numRelationshipsUploaded: 1,
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
    'run',
    '--source',
    'api',
    '--scope',
    'test',
  ]);

  expect(eventsPublished).toBe(false);
  expect(log.displayExecutionResults).toHaveBeenCalledTimes(1);
  expect(log.displaySynchronizationResults).toHaveBeenCalledTimes(1);
});

test('should use JUPITERONE_API_KEY value in Authorization request header', async () => {
  expect.assertions(1);
  const job = generateSynchronizationJob();

  setupSynchronizerApi({
    polly,
    job,
    baseUrl: 'https://api.us.jupiterone.io',
    onSyncJobCreateResponse(req, res) {
      expect(req.headers['Authorization']).toEqual('Bearer testing-key');
    },
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
  ]);
});
