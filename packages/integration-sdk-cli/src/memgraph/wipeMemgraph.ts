import { MemgraphGraphStore } from './memgraphGraphStore';

type WipeMemgraphParams = {
  integrationInstanceID: string;
  memgraphUri?: string;
  memgraphUser?: string;
  memgraphPassword?: string;
  memgraphDatabase?: string;
};
export async function wipeMemgraphByID({
  integrationInstanceID,
  memgraphUri = process.env.MEMGRAPH_URI,
  memgraphUser = process.env.MEMGRAPH_USER,
  memgraphPassword = process.env.MEMGRAPH_PASSWORD,
  memgraphDatabase,
}: WipeMemgraphParams) {
  if (!memgraphUri || !memgraphUser || !memgraphPassword) {
    throw new Error(
      'ERROR: must provide login information in function call or include MEMGRAPH_URI, MEMGRAPH_USER, and MEMGRAPH_PASSWORD files in your .env file!',
    );
  }

  const store = new MemgraphGraphStore({
    uri: memgraphUri,
    username: memgraphUser,
    password: memgraphPassword,
    integrationInstanceID: integrationInstanceID,
    database: memgraphDatabase,
  });
  try {
    await store.wipeInstanceIdData();
  } finally {
    await store.close();
  }
}

type WipeAllMemgraphParams = {
  memgraphUri?: string;
  memgraphUser?: string;
  memgraphPassword?: string;
  memgraphDatabase?: string;
};

export async function wipeAllMemgraph({
  memgraphUri = process.env.MEMGRAPH_URI,
  memgraphUser = process.env.MEMGRAPH_USER,
  memgraphPassword = process.env.MEMGRAPH_PASSWORD,
  memgraphDatabase,
}: WipeAllMemgraphParams) {
  if (!memgraphUri || !memgraphUser || !memgraphPassword) {
    throw new Error(
      'ERROR: must provide login information in function call or include MEMGRAPH_URI, MEMGRAPH_USER, and MEMGRAPH_PASSWORD files in your .env file!',
    );
  }

  const store = new MemgraphGraphStore({
    uri: memgraphUri,
    username: memgraphUser,
    password: memgraphPassword,
    integrationInstanceID: '',
    database: memgraphDatabase,
  });
  try {
    await store.wipeDatabase();
  } finally {
    await store.close();
  }
}
