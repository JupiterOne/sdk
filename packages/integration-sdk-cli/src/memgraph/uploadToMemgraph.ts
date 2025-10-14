import { MemgraphGraphStore } from './memgraphGraphStore';
import {
  iterateParsedGraphFiles,
  isDirectoryPresent,
} from '@jupiterone/integration-sdk-runtime';
import { FlushedGraphObjectData } from '@jupiterone/integration-sdk-runtime/src/storage/types';

type UploadToMemgraphParams = {
  pathToData: string;
  integrationInstanceID: string;
  memgraphUri?: string;
  memgraphUser?: string;
  memgraphPassword?: string;
  memgraphDatabase?: string;
};

export async function uploadToMemgraph({
  pathToData,
  integrationInstanceID,
  memgraphUri = process.env.MEMGRAPH_URI,
  memgraphUser = process.env.MEMGRAPH_USER,
  memgraphPassword = process.env.MEMGRAPH_PASSWORD,
  memgraphDatabase,
}: UploadToMemgraphParams) {
  if (!memgraphUri || !memgraphUser || !memgraphPassword) {
    throw new Error(
      'ERROR: must provide login information in function call or include MEMGRAPH_URI, MEMGRAPH_USER, and MEMGRAPH_PASSWORD files in your .env file!',
    );
  }
  if (!(await isDirectoryPresent(pathToData))) {
    throw new Error('ERROR: graph directory does not exist!');
  }

  const store = new MemgraphGraphStore({
    uri: memgraphUri,
    username: memgraphUser,
    password: memgraphPassword,
    integrationInstanceID: integrationInstanceID,
    database: memgraphDatabase,
  });

  async function handleGraphObjectEntityFiles(
    parsedData: FlushedGraphObjectData,
  ) {
    if (parsedData.entities) await store.addEntities(parsedData.entities);
  }

  async function handleGraphObjectRelationshipFiles(
    parsedData: FlushedGraphObjectData,
  ) {
    if (parsedData.relationships)
      await store.addRelationships(parsedData.relationships);
  }

  try {
    await iterateParsedGraphFiles(handleGraphObjectEntityFiles, pathToData);
    await iterateParsedGraphFiles(
      handleGraphObjectRelationshipFiles,
      pathToData,
    );
  } finally {
    await store.close();
  }
}
