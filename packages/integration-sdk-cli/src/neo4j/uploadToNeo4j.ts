import { Neo4jGraphStore } from './neo4jGraphStore';
import {
  iterateParsedGraphFiles,
  isDirectoryPresent,
} from '@jupiterone/integration-sdk-runtime';
import { FlushedGraphObjectData } from '@jupiterone/integration-sdk-runtime/src/storage/types';

type UploadToNeo4jParams = {
  pathToData: string;
  integrationInstanceID: string;
  neo4jUri?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
};

export async function uploadToNeo4j({
  pathToData,
  integrationInstanceID,
  neo4jUri = process.env.NEO4J_URI,
  neo4jUser = process.env.NEO4J_USER,
  neo4jPassword = process.env.NEO4J_PASSWORD,
}: UploadToNeo4jParams) {
  if (!neo4jUri || !neo4jUser || !neo4jPassword) {
    throw new Error(
      'ERROR: must provide login information in function call or include NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD files in your .env file!',
    );
  }
  if (!isDirectoryPresent(pathToData)) {
    throw new Error('ERROR: graph directory does not exist!');
  }

  const store = new Neo4jGraphStore({
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
    integrationInstanceID: integrationInstanceID,
  });

  async function handleGraphObjectFile(parsedData: FlushedGraphObjectData) {
    if (parsedData.entities) await store.addEntities(parsedData.entities);
    if (parsedData.relationships)
      await store.addRelationships(parsedData.relationships);
  }

  try {
    await iterateParsedGraphFiles(handleGraphObjectFile, pathToData);
  } finally {
    await store.close();
  }
}
