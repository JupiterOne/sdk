import * as log from '../log';
import * as fs from 'fs';
import * as path from 'path';
import { Neo4jGraphStore } from './neo4jGraphStore';


export async function uploadToNeo4j(pathToData: string, integrationInstanceID: string) {
  if(!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
    throw new Error('ERROR: must include NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD files in your .env file!');
  }
  if (!fs.existsSync(pathToData)) {
    throw new Error('ERROR: graph directory does not exist!');
  }
  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USER;
  const neo4jPassword = process.env.NEO4J_PASSWORD;

  const store = new Neo4jGraphStore(integrationInstanceID, {
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
  });
  try {
    // We do all entities and then all relationships to ensure that both the
    // start and end nodes are in place and available for relationship creation
    // instead of trying to do any fancy Cypher steps.
    for await (const integrationStepDirectory of fs.readdirSync(pathToData)) {
      log.info(`Scanning entities in integrationStepDirectory ${integrationStepDirectory}`);
      for await (const entityOrRelationshipDirectory of fs.readdirSync(
        path.join(pathToData, integrationStepDirectory),
      )) {
        if (entityOrRelationshipDirectory === 'entities') {
          for await (const file of fs.readdirSync(
            path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory),
          )) {
            const entityData = JSON.parse(
              fs.readFileSync(
                path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory, file),
                'utf-8',
              ),
            );
            await store.addEntities(entityData.entities);
          }
        }
      }
    }
    for await (const integrationStepDirectory of fs.readdirSync(pathToData)) {
      log.info(`Scanning relationships in graphDirectory ${integrationStepDirectory}`);
      for await (const entityOrRelationshipDirectory of fs.readdirSync(
        path.join(pathToData, integrationStepDirectory),
      )) {
        if (entityOrRelationshipDirectory === 'relationships') {
          for await (const file of fs.readdirSync(
            path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory),
          )) {
            const relationshipData = JSON.parse(
              fs.readFileSync(
                path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory, file),
                'utf-8',
              ),
            );
            await store.addRelationships(relationshipData.relationships);
          }
        }
      }
    }
  } finally {
    await store.close();
  }
}
