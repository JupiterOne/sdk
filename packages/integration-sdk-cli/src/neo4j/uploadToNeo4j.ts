import * as log from '../log';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Neo4jGraphStore } from './neo4jGraphStore';

type UploadToNeo4jParams = {
  pathToData: string;
  integrationInstanceID: string;
  neo4jUri?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
}

async function isFolder_sync(path) {
  try {
      const stat = await fs.stat(path);
      return stat.isDirectory();
  } catch (err) {
      // if it's simply a not found error
      if (err.code === "ENOENT") {
          return false;
      }
  }
}

export async function uploadToNeo4j({
  pathToData,
  integrationInstanceID,
  neo4jUri = process.env.NEO4J_URI,
  neo4jUser = process.env. NEO4J_USER,
  neo4jPassword = process.env. NEO4J_PASSWORD,
}: UploadToNeo4jParams) {
  if(!neo4jUri || !neo4jUser || !neo4jPassword) {
    throw new Error('ERROR: must provide login information in function call or include NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD files in your .env file!');
  }
  if (!isFolder_sync(pathToData)) {
    throw new Error('ERROR: graph directory does not exist!');
  }

  const store = new Neo4jGraphStore({
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
    integrationInstanceID: integrationInstanceID,
  });
  try {
    // We do all entities and then all relationships to ensure that both the
    // start and end nodes are in place and available for relationship creation
    // instead of trying to do any fancy Cypher steps.
    for await (const integrationStepDirectory of await fs.readdir(pathToData)) {
      log.info(`Scanning entities in integrationStepDirectory ${integrationStepDirectory}`);
      for await (const entityOrRelationshipDirectory of await fs.readdir(
        path.join(pathToData, integrationStepDirectory),
      )) {
        if (entityOrRelationshipDirectory === 'entities') {
          for await (const file of await fs.readdir(
            path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory),
          )) {
            const entityData = JSON.parse(
              await fs.readFile(
                path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory, file),
                'utf-8',
              ),
            );
            await store.addEntities(entityData.entities);
          }
        }
      }
    }
    for await (const integrationStepDirectory of await fs.readdir(pathToData)) {
      log.info(`Scanning relationships in graphDirectory ${integrationStepDirectory}`);
      for await (const entityOrRelationshipDirectory of await fs.readdir(
        path.join(pathToData, integrationStepDirectory),
      )) {
        if (entityOrRelationshipDirectory === 'relationships') {
          for await (const file of await fs.readdir(
            path.join(pathToData, integrationStepDirectory, entityOrRelationshipDirectory),
          )) {
            const relationshipData = JSON.parse(
              await fs.readFile(
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
