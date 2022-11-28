import axios from 'axios';
import * as runtime from '@jupiterone/integration-sdk-runtime';

import { createCli } from '..';
import { TEST_API_KEY, TEST_ACCOUNT } from './utils';
import * as log from '../log';
import { vol } from 'memfs';
import { createEntity, createRelationship } from '../export/__tests__/utils';

jest.mock('@jupiterone/integration-sdk-runtime');
jest.mock('axios');
jest.mock('ora');
jest.mock('fs');
jest.mock('../log');

const mockedAxios = jest.mocked(axios);
const mockedCreateApiClient = jest.mocked(runtime.createApiClient);

beforeEach(() => {
  mockedCreateApiClient.mockReturnValue(axios);
  mockedAxios.get.mockReset();
  delete process.env.JUPITERONE_API_KEY;
  jest.clearAllMocks();
  vol.reset();
});

test('should export assets', async () => {
  mockedAxios.get
    .mockResolvedValueOnce({
      data: {
        items: [
          createEntity({
            type: '1',
            id: '1',
            optionalProps: {
              'tag.Production': JSON.stringify({
                object: { innerProp: 'foobar' },
              }),
            },
          }),
          createEntity({ type: '2', id: '2' }),
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        items: [
          createRelationship({
            from: createEntity({ type: '1', id: '1' }),
            to: createEntity({ type: '2', id: '2' }),
          }),
        ],
      },
    });

  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'export',
      `--account=${TEST_ACCOUNT}`,
      `--api-key=${TEST_API_KEY}`,
      `--api-base-url=https://api.TEST.jupiterone.io`,
    ]),
  ).resolves.toEqual(expect.anything());
  expect(Object.values(vol.toJSON())).toMatchInlineSnapshot(`
    [
      "[{"id":"entity-1","name":"Entity 1","displayName":"Entity 1","createdOn":1591831808891,"_class":"Entity","_type":"entity_type_1","_key":"entity-1","tag.Production":"{\\"object\\":{\\"innerProp\\":\\"foobar\\"}}"}]",
      "[{"id":"entity-2","name":"Entity 2","displayName":"Entity 2","createdOn":1591831808892,"_class":"Entity","_type":"entity_type_2","_key":"entity-2"}]",
      "[{"_key":"entity-1|has|entity-2","_type":"entity_type_1_has_2","_class":"HAS","_fromEntityKey":"entity-1","_toEntityKey":"entity-2","displayName":"HAS"}]",
      "id,name,displayName,createdOn,_class,_type,_key,tag.Production
    entity-1,Entity 1,Entity 1,1591831808891,Entity,entity_type_1,entity-1,"{""object"":{""innerProp"":""foobar""}}"",
      "id,name,displayName,createdOn,_class,_type,_key
    entity-2,Entity 2,Entity 2,1591831808892,Entity,entity_type_2,entity-2",
      "_key,_type,_class,_fromEntityKey,_toEntityKey,displayName
    entity-1|has|entity-2,entity_type_1_has_2,HAS,entity-1,entity-2,HAS",
    ]
  `);
  expect(mockedCreateApiClient).toBeCalledWith({
    accessToken: 'apiKey',
    account: 'account',
    apiBaseUrl: 'https://api.TEST.jupiterone.io',
  });
});
test('should only export relationships when specified', async () => {
  mockedAxios.get
    .mockResolvedValueOnce({
      data: {
        items: [
          createRelationship({
            from: createEntity({ type: '1', id: '1' }),
            to: createEntity({ type: '2', id: '2' }),
          }),
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        items: [
          createEntity({
            type: '1',
            id: '1',
            optionalProps: {
              'tag.Production': JSON.stringify({
                object: { innerProp: 'foobar' },
              }),
            },
          }),
          createEntity({ type: '2', id: '2' }),
        ],
      },
    });

  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'export',
      `--account=${TEST_ACCOUNT}`,
      `--api-key=${TEST_API_KEY}`,
      `--no-include-entities`,
    ]),
  ).resolves.toEqual(expect.anything());
  expect(Object.values(vol.toJSON())).toMatchInlineSnapshot(`
    [
      "[{"_key":"entity-1|has|entity-2","_type":"entity_type_1_has_2","_class":"HAS","_fromEntityKey":"entity-1","_toEntityKey":"entity-2","displayName":"HAS"}]",
      "_key,_type,_class,_fromEntityKey,_toEntityKey,displayName
    entity-1|has|entity-2,entity_type_1_has_2,HAS,entity-1,entity-2,HAS",
    ]
  `);
});
test('should only export entities when specified', async () => {
  mockedAxios.get
    .mockResolvedValueOnce({
      data: {
        items: [
          createEntity({
            type: '1',
            id: '1',
            optionalProps: {
              'tag.Production': JSON.stringify({
                object: { innerProp: 'foobar' },
              }),
            },
          }),
          createEntity({ type: '2', id: '2' }),
        ],
      },
    })
    .mockResolvedValueOnce({
      data: {
        items: [
          createRelationship({
            from: createEntity({ type: '1', id: '1' }),
            to: createEntity({ type: '2', id: '2' }),
          }),
        ],
      },
    });

  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'export',
      `--account=${TEST_ACCOUNT}`,
      `--api-key=${TEST_API_KEY}`,
      `--no-include-entities`,
    ]),
  ).resolves.toEqual(expect.anything());
  expect(Object.values(vol.toJSON())).toMatchInlineSnapshot(`
    [
      "[{"id":"entity-1","name":"Entity 1","displayName":"Entity 1","createdOn":1591831808891,"_class":"Entity","_type":"entity_type_1","_key":"entity-1","tag.Production":"{\\"object\\":{\\"innerProp\\":\\"foobar\\"}}"}]",
      "[{"id":"entity-2","name":"Entity 2","displayName":"Entity 2","createdOn":1591831808892,"_class":"Entity","_type":"entity_type_2","_key":"entity-2"}]",
      "id,name,displayName,createdOn,_class,_type,_key,tag.Production
    entity-1,Entity 1,Entity 1,1591831808891,Entity,entity_type_1,entity-1,"{""object"":{""innerProp"":""foobar""}}"",
      "id,name,displayName,createdOn,_class,_type,_key
    entity-2,Entity 2,Entity 2,1591831808892,Entity,entity_type_2,entity-2",
    ]
  `);
});

test('should log error when export fails', async () => {
  const error = new Error();
  mockedAxios.get.mockRejectedValue(error);

  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'export',
      `--account=${TEST_ACCOUNT}`,
      `--api-key=${TEST_API_KEY}`,
    ]),
  ).rejects.toThrow(error);

  expect(log.error).toHaveBeenCalledWith(error);
});

test('should throw error when missing api key', async () => {
  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'export',
      `--account=${TEST_ACCOUNT}`,
    ]),
  ).rejects.toThrow(
    /Missing option! Set the JUPITERONE_API_KEY environment variable or supply the --api-key option./,
  );
});

test('should throw error when missing account', async () => {
  await expect(
    createCli().parseAsync([
      'node',
      'j1',
      'export',
      `--api-key=${TEST_API_KEY}`,
    ]),
  ).rejects.toThrow(
    /Missing option! Set the JUPITERONE_ACCOUNT environment variable or supply the --account option./,
  );
});
