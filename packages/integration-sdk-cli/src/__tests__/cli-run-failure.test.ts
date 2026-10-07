import { loadProjectStructure } from '@jupiterone/integration-sdk-private-test-utils';

import { createCli } from '../index';
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
  loadProjectStructure('validationFailure');

  jest.spyOn(process, 'exit').mockImplementation((code: number | undefined) => {
    throw new Error(`Process exited with code ${code}`);
  });
});

afterEach(async () => {
  delete process.env.JUPITERONE_API_KEY;
  await api?.close();
  api = undefined;
});

test('aborts synchronization job if an error occurs', async () => {
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

  expect(api.aborted).toBe(true);
});
