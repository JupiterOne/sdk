import {
  createIntegrationEntity,
  Entity,
  createIntegrationRelationship,
} from '@jupiterone/integration-sdk-core';
import { parseObjectsToCsv } from './parseObjectsToCsv';
import csv = require('csvtojson');

test('should convert entities to csv', async () => {
  const entities = [
    generateEntity('0', '0'),
    generateEntity('1', '0'),
    generateEntity('0', '1'),
    generateEntity('1', '1'),
  ];

  const results = parseObjectsToCsv(entities);

  const group1 = await csv({ checkType: true }).fromString(
    results['entity_type_0'],
  );
  const group2 = await csv({ checkType: true }).fromString(
    results['entity_type_1'],
  );

  expect(results).toEqual({
    entity_type_0: expect.stringContaining(`"id","name","displayName","createdOn","_class.0","_type","_key","_rawData.0.name","_rawData.0.rawData.id","_rawData.0.rawData.name","_rawData.0.rawData.displayName","_rawData.0.rawData.createdOn"
"entity-0","Entity 0","Entity 0",1591831808890,"Entity","entity_type_0","entity-0","default","entity-0","Entity 0","Entity 0",1591831808890
"entity-1","Entity 1","Entity 1",1591831808891,"Entity","entity_type_0","entity-1","default","entity-1","Entity 1","Entity 1",1591831808891`),
    entity_type_1: expect.stringContaining(`"id","name","displayName","createdOn","_class.0","_type","_key","_rawData.0.name","_rawData.0.rawData.id","_rawData.0.rawData.name","_rawData.0.rawData.displayName","_rawData.0.rawData.createdOn"
"entity-0","Entity 0","Entity 0",1591831808890,"Entity","entity_type_1","entity-0","default","entity-0","Entity 0","Entity 0",1591831808890
"entity-1","Entity 1","Entity 1",1591831808891,"Entity","entity_type_1","entity-1","default","entity-1","Entity 1","Entity 1",1591831808891`),
  });

  expect(group1).toEqual([entities[0], entities[1]]);
  expect(group2).toEqual([entities[2], entities[3]]);
});

test('should convert relationships to csv', async () => {
  const relationships = [
    generateRelationship(
      '0',
      '0',
      generateEntity('0', '0'),
      generateEntity('1', '1'),
    ),
    generateRelationship(
      '1',
      '0',
      generateEntity('0', '1'),
      generateEntity('1', '1'),
    ),
    generateRelationship(
      '2',
      '1',
      generateEntity('1', '1'),
      generateEntity('1', '1'),
    ),
    generateRelationship(
      '3',
      '1',
      generateEntity('2', '0'),
      generateEntity('1', '1'),
    ),
  ];

  const results = parseObjectsToCsv(relationships);

  const group1 = await csv({ checkType: true }).fromString(
    results['entity_type_0_has_1'],
  );
  const group2 = await csv({ checkType: true }).fromString(
    results['entity_type_1_has_1'],
  );

  expect(results).toEqual({
    entity_type_0_has_1: `"_key","_type","_class","_fromEntityKey","_toEntityKey","displayName"
"entity-0|has|entity-1","entity_type_0_has_1","HAS","entity-0","entity-1","HAS"
"entity-2|has|entity-1","entity_type_0_has_1","HAS","entity-2","entity-1","HAS"`,
    entity_type_1_has_1: `"_key","_type","_class","_fromEntityKey","_toEntityKey","displayName"
"entity-0|has|entity-1","entity_type_1_has_1","HAS","entity-0","entity-1","HAS"
"entity-1|has|entity-1","entity_type_1_has_1","HAS","entity-1","entity-1","HAS"`,
  });

  expect(group1).toEqual([relationships[0], relationships[3]]);
  expect(group2).toEqual([relationships[1], relationships[2]]);
});

const generateEntity = (id: string, type: string) => {
  return createIntegrationEntity({
    entityData: {
      source: {
        id: `entity-${id}`,
        name: `Entity ${id}`,
        displayName: `Entity ${id}`,
        createdOn: +`159183180889${id}`,
      },
      assign: {
        _class: 'Entity',
        _type: `entity_type_${type}`,
      },
    },
  });
};

const generateRelationship = (
  id: string,
  type: string,
  from: Entity,
  to: Entity,
) => {
  return createIntegrationRelationship({
    _class: 'HAS',
    from,
    to,
  });
};
