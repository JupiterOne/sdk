import { mocked } from 'ts-jest/utils';

import { readJsonFromPath } from '@jupiterone/integration-sdk-runtime';
import {
  createDirectRelationship,
  ExplicitRelationship,
} from '@jupiterone/integration-sdk-core';

import { retrieveIntegrationData } from '../retrieveIntegrationData';
import { IntegrationData } from '../types';
import { RelationshipClass } from '@jupiterone/data-model';

jest.mock('@jupiterone/integration-sdk-runtime');

const mockedReadJson = mocked(readJsonFromPath);

const integrationPath = '/j1-integration';
const integrationData: IntegrationData = {
  entities: [
    { id: '1', _class: 'entity', _key: 'entity:1', _type: 'entity' },
    { id: '2', _class: 'entity', _key: 'entity:2', _type: 'entity' },
  ],
  relationships: [
    createDirectRelationship({
      _class: RelationshipClass.HAS,
      fromKey: 'entity:1',
      fromType: 'entity',
      toKey: 'entity:2',
      toType: 'entity',
    }) as ExplicitRelationship,
  ],
  mappedRelationships: [],
};

afterEach(() => {
  jest.resetAllMocks();
});

test('no files found returns empty result set', async () => {
  const result = await retrieveIntegrationData([]);
  expect(result.entities).toEqual([]);
  expect(result.relationships).toEqual([]);
});

test('returns the json objects read from the files', async () => {
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({ relationships: integrationData.relationships });

  const result = await retrieveIntegrationData([
    `${integrationPath}/graph/entity/entities/123.json`,
    `${integrationPath}/graph/entity/relationships/abc.json`,
  ]);

  expect(result).toEqual(integrationData);
});

test('includes mapped relationships', async () => {
  const mappedRelationship = {
    _mapping: 'user_is_user',
    id: '123456',
  };
  mockedReadJson
    .mockResolvedValueOnce({ entities: integrationData.entities })
    .mockResolvedValueOnce({
      relationships: [...integrationData.relationships, mappedRelationship],
    });

  const result = await retrieveIntegrationData([
    `${integrationPath}/graph/entity/entities/123.json`,
    `${integrationPath}/graph/entity/relationships/abc.json`,
  ]);

  expect(result).toEqual({
    ...integrationData,
    mappedRelationships: [{ _mapping: 'user_is_user', id: '123456' }],
  });
});
