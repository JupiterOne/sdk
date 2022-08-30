import { Neo4jGraphStore } from './neo4jGraphStore';

type WipeNeo4jParams = {
  integrationInstanceID: string;
  neo4jUri?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
  neo4jDatabase?: string;
};
export async function wipeNeo4jByID({
  integrationInstanceID,
  neo4jUri = process.env.NEO4J_URI,
  neo4jUser = process.env.NEO4J_USER,
  neo4jPassword = process.env.NEO4J_PASSWORD,
  neo4jDatabase,
}: WipeNeo4jParams) {
  if (!neo4jUri || !neo4jUser || !neo4jPassword) {
    throw new Error(
      'ERROR: must provide login information in function call or include NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD files in your .env file!',
    );
  }

  const store = new Neo4jGraphStore({
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
    integrationInstanceID: integrationInstanceID,
    database: neo4jDatabase,
  });
  try {
    await store.wipeInstanceIdData();
  } finally {
    await store.close();
  }
}

type WipeAllNeo4jParams = {
  neo4jUri?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
  neo4jDatabase?: string;
};

export async function wipeAllNeo4j({
  neo4jUri = process.env.NEO4J_URI,
  neo4jUser = process.env.NEO4J_USER,
  neo4jPassword = process.env.NEO4J_PASSWORD,
  neo4jDatabase,
}: WipeAllNeo4jParams) {
  if (!neo4jUri || !neo4jUser || !neo4jPassword) {
    throw new Error(
      'ERROR: must provide login information in function call or include NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD files in your .env file!',
    );
  }

  const store = new Neo4jGraphStore({
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
    integrationInstanceID: '',
    database: neo4jDatabase,
  });
  try {
    await store.wipeDatabase();
  } finally {
    await store.close();
  }
}
