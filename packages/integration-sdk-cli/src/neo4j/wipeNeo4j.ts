import { Neo4jGraphStore } from './neo4jGraphStore';
import * as log from '../log';

export async function wipeNeo4jByID(integrationInstanceID: string) {
  if(!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) {
    throw new Error('ERROR: must include NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD files in your .env file!');
  }
  log.info(`Wiping Neo4j data for integrationInstanceID: ${integrationInstanceID}`);

  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USER;
  const neo4jPassword = process.env.NEO4J_PASSWORD;

  const store = new Neo4jGraphStore(integrationInstanceID, {
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
  });
  try {
    await store.wipeInstanceIdData();
  } finally {
    await store.close();
  }
}

export async function wipeAllNeo4j() {
  log.info(`Wiping all Neo4j data`);

  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD || 'neo4j';

  const store = new Neo4jGraphStore('', {
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
  });
  try {
    await store.wipeDatabase();
  } finally {
    await store.close();
  }
}