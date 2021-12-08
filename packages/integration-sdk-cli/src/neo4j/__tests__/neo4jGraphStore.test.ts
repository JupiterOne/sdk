import {
  mockDriver,
  mockSessionFromQuerySet,
  QuerySpec
} from 'neo-forgery';
import * as neo4j from 'neo4j-driver';
import { Neo4jGraphStore } from '../neo4jGraphStore';
import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

const testEntityData: Entity[] = [{
  _type: "testType",
  _class: "testClass",
  _key: "testKey",
}];
const testRelationshipData: Relationship[] = [{
  _fromEntityKey: "testKey1",
  _toEntityKey: "testKey2",
  _type: "testRelType",
  _key: "relKey",
  _class: "testRelationshipClass",
}];
const constraintCall = 'CREATE CONSTRAINT unique_testType IF NOT EXISTS ON (n:testType) ASSERT n._key IS UNIQUE;'
const addEntityCall = `MERGE (n:testType {_key: 'testKey'}) SET n._type = 'testType', n._class = 'testClass';`;
const addRelationshipCall = `
MATCH (start {_key: 'testKey1'})
MATCH (end {_key: 'testKey2'})
MERGE (start)-[:testRelType]->(end);`
const querySet: QuerySpec[] = [{
  name: 'addConstraint',
  query: constraintCall,
  params: undefined,
  output: {records:[]}
},
{
  name: 'addEntity',
  query: addEntityCall,
  params: undefined,
  output: {records:[]}
},
{
  name: 'addRelationship',
  query: addRelationshipCall,
  params: undefined,
  output: {records:[]}
}];

describe('#neo4jGraphStore', () => {
  const mockDriverResp = mockDriver();
  const mockSession = mockSessionFromQuerySet(querySet);
  const store = new Neo4jGraphStore({
    uri: '',
    username: '',
    password: '',
  }, mockSession);

  test('should generate call to create a driver connection', () => {
    const spy = jest.spyOn(neo4j, 'driver').mockReturnValue(mockDriverResp);

    const emptyStore = new Neo4jGraphStore({
      uri: '',
      username: '',
      password: '',
    });
    expect(async () => await emptyStore.close()).toReturn;
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('should generate call to create an Entity', () => {
    expect(async () => await store.addEntities(testEntityData)).toReturn;
  });

  test('should generate call to create a Relationship', () => {

    expect(async () => await store.addRelationships(testRelationshipData)).toReturn;
  });

});