import * as runtime from '@jupiterone/integration-sdk-runtime';
import axios from 'axios';
import { mocked } from 'jest-mock';
import { vol } from 'memfs';
import { randomUUID as uuid } from 'crypto';
import globby from 'globby';

import {
  TEST_ACCOUNT,
  TEST_API_KEY,
  TEST_STORAGE_LOCATION,
} from '../__tests__/utils';
import {
  createRelationship,
  parseToCsv,
  createEntity,
} from '../export/__tests__/utils';
import * as log from '../log';
import { createCli } from '..';

jest.mock('@jupiterone/integration-sdk-runtime');
jest.mock('axios');
jest.mock('ora');
jest.mock('fs');
jest.mock('globby');
jest.mock('../pause');
jest.mock('../log');

const mockedCreateApiClient = mocked(runtime.createApiClient, true);
const mockedAxios = mocked(axios, true);
const mockedGlobby = mocked(globby, true);

const type1Entities = [
  createEntity({
    id: '1',
    type: '1',
    optionalProps: {
      'tag.Production': JSON.stringify({
        nested: {
          object: 'foobar',
        },
      }),
    },
  }),
  createEntity({ id: '2', type: '1' }),
];

const type2Entities = [
  createEntity({ id: '3', type: '2' }),
  createEntity({ id: '4', type: '2' }),
];

const type1Relationships = [
  createRelationship({
    from: createEntity({ id: '3', type: '2' }),
    to: createEntity({ id: '4', type: '2' }),
  }),
];

beforeEach(async () => {
  mockedCreateApiClient.mockReturnValue(axios);
  vol.reset();
  vol.fromJSON({
    [`${TEST_STORAGE_LOCATION}/csv/entities/entity_type_1/${uuid()}.csv`]:
      await parseToCsv(type1Entities),
    [`${TEST_STORAGE_LOCATION}/csv/entities/entity_type_2/${uuid()}.csv`]:
      await parseToCsv(type2Entities),
    [`${TEST_STORAGE_LOCATION}/csv/relationships/relationship_type_1/${uuid()}.csv`]:
      await parseToCsv(type1Relationships),
  });
  mockedGlobby.mockImplementation((path) => {
    let paths: string[] = [];
    if (path.includes('entities')) {
      paths = Object.keys(vol.toJSON()).filter((file) =>
        file.includes('/entities/'),
      );
    } else {
      paths = Object.keys(vol.toJSON()).filter((file) =>
        file.includes('/relationships/'),
      );
    }

    return Promise.resolve(paths);
  });
  jest.clearAllMocks();
});

test('should import json assets', async () => {
  const jobId = uuid();
  mockedAxios.post.mockResolvedValue({ data: { job: { id: jobId } } });
  mockedAxios.get.mockResolvedValue({
    data: { job: { id: jobId, status: 'FINISHED' } },
  });

  const scope = uuid();
  await createCli().parseAsync([
    'node',
    'j1',
    'import',
    `--account=${TEST_ACCOUNT}`,
    `--api-key=${TEST_API_KEY}`,
    `--scope=${scope}`,
    `--api-base-url=https://api.TEST.jupiterone.io`,
  ]);

  expect(mockedAxios.post).toHaveBeenCalledWith(
    '/persister/synchronization/jobs',
    {
      source: 'api',
      scope,
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/relationships?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    await parseToCsv(type1Relationships),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/entities?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    await parseToCsv(type1Entities),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/entities?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    await parseToCsv(type2Entities),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/finalize`,
  );
  expect(mockedCreateApiClient).toBeCalledWith({
    accessToken: 'apiKey',
    account: 'account',
    apiBaseUrl: 'https://api.TEST.jupiterone.io',
  });
});

test('should exclude relationships when specified', async () => {
  const jobId = uuid();
  mockedAxios.post.mockResolvedValue({ data: { job: { id: jobId } } });
  mockedAxios.get.mockResolvedValue({
    data: { job: { id: jobId, status: 'FINISHED' } },
  });

  const scope = uuid();
  await createCli().parseAsync([
    'node',
    'j1',
    'import',
    `--account=${TEST_ACCOUNT}`,
    `--api-key=${TEST_API_KEY}`,
    `--scope=${scope}`,
    `--no-include-relationships`,
  ]);

  expect(mockedAxios.post).toHaveBeenCalledWith(
    '/persister/synchronization/jobs',
    {
      source: 'api',
      scope,
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/entities?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    await parseToCsv(type1Entities),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/entities?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    await parseToCsv(type2Entities),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).not.toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/relationships?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    expect.anything(),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/finalize`,
  );
});

test('should exclude relationships when specified', async () => {
  const jobId = uuid();
  mockedAxios.post.mockResolvedValue({ data: { job: { id: jobId } } });
  mockedAxios.get.mockResolvedValue({
    data: { job: { id: jobId, status: 'FINISHED' } },
  });

  const scope = uuid();
  await createCli().parseAsync([
    'node',
    'j1',
    'import',
    `--account=${TEST_ACCOUNT}`,
    `--api-key=${TEST_API_KEY}`,
    `--scope=${scope}`,
    `--no-include-entities`,
  ]);

  expect(mockedAxios.post).toHaveBeenCalledWith(
    '/persister/synchronization/jobs',
    {
      source: 'api',
      scope,
    },
  );
  expect(mockedAxios.post).not.toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/entities?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    expect.anything(),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/relationships?ignoreDuplicates=true&ignoreIllegalProperties=true`,
    await parseToCsv(type1Relationships),
    {
      headers: { 'Content-Type': 'text/csv' },
    },
  );
  expect(mockedAxios.post).toHaveBeenCalledWith(
    `/persister/synchronization/jobs/${jobId}/finalize`,
  );
});

test('should throw error when missing api key', async () => {
  // if a developer has these set it could interfere with the test
  delete process.env.JUPITERONE_ACCOUNT;
  delete process.env.JUPITERONE_API_KEY;
  await expect(
    createCli().parseAsync(['node', 'j1', 'import', `--scope=${uuid()}`]),
  ).rejects.toThrow(
    /Missing option! Set the JUPITERONE_API_KEY environment variable or supply the --api-key option./,
  );
});

test('should throw error when missing account', async () => {
  // if a developer has these set it could interfere with the test
  delete process.env.JUPITERONE_ACCOUNT;
  delete process.env.JUPITERONE_API_KEY;

  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'import',
      `--api-key=${TEST_API_KEY}`,
      `--scope=${uuid()}`,
    ]),
  ).rejects.toThrow(
    /Missing option! Set the JUPITERONE_ACCOUNT environment variable or supply the --account option./,
  );
});

test('should log error when import fails', async () => {
  const error = new Error();
  mockedAxios.post.mockRejectedValue(error);

  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'import',
      `--account=${TEST_ACCOUNT}`,
      `--api-key=${TEST_API_KEY}`,
      `--scope=${uuid()}`,
    ]),
  ).rejects.toThrow(error);

  expect(log.error).toHaveBeenCalledWith(error);
});
