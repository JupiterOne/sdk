import { createCli } from '../index';
import { loadProjectStructure } from '@jupiterone/integration-sdk-private-test-utils';

import {
  generateSynchronizationJob,
  startSynchronizerApi,
  SynchronizerApi,
} from './util/synchronization';

jest.mock('../log');

let api: SynchronizerApi | undefined;

beforeEach(() => {
  process.env.JUPITERONE_API_KEY = 'testing-key';
  process.env.JUPITERONE_ACCOUNT = 'mochi';

  loadProjectStructure('typeScriptIntegrationProject');

  jest.spyOn(process, 'exit').mockImplementation((code: number | undefined) => {
    throw new Error(`Process exited with code ${code}`);
  });
});

afterEach(async () => {
  delete process.env.JUPITERONE_API_KEY;
  delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
  await api?.close();
  api = undefined;
});

test('enables graph object schema validation', async () => {
  api = await startSynchronizerApi({ job: generateSynchronizationJob() });

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--api-base-url',
    api.baseUrl,
  ]);

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
});

test('disables graph object schema validation', async () => {
  api = await startSynchronizerApi({ job: generateSynchronizationJob() });

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--disable-schema-validation',
    '--api-base-url',
    api.baseUrl,
  ]);

  expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();
});

test('executes integration and performs upload', async () => {
  api = await startSynchronizerApi({ job: generateSynchronizationJob() });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--api-base-url',
    api.baseUrl,
  ]);

  expect(api.finalized).toBe(true);
});

test('executes integration and skips finalization with skip-finalize', async () => {
  api = await startSynchronizerApi({ job: generateSynchronizationJob() });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--skip-finalize',
    '--api-base-url',
    api.baseUrl,
  ]);

  expect(api.finalized).toBe(false);
});

test('does not publish events for source "api" since there is no integrationJobId', async () => {
  api = await startSynchronizerApi({
    job: generateSynchronizationJob({ source: 'api', scope: 'test' }),
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--source',
    'api',
    '--scope',
    'test',
    '--api-base-url',
    api.baseUrl,
  ]);

  expect(api.eventsPublished).toBe(false);
});

test('should use JUPITERONE_API_KEY value in Authorization request header', async () => {
  expect.assertions(1);
  api = await startSynchronizerApi({
    job: generateSynchronizationJob(),
    onCreateJob(_body, req) {
      expect(req.headers['authorization']).toEqual('Bearer testing-key');
    },
  });

  await createCli().parseAsync([
    'node',
    'j1-integration',
    'run',
    '--integrationInstanceId',
    'test',
    '--api-base-url',
    api.baseUrl,
  ]);
});
