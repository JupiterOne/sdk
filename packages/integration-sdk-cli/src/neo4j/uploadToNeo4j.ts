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
    // We have to traverse all graph files twice so that we can first create all
    // entities followed by all relationships.  The current Neo4j data architecture
    // only uses indexes and not constraints due to the fact that we would need a node
    // key constraint consisting of both the _key value as well as the _integrationInstanceID
    // value and that would require users to have an enterprise Neo4j instance instead
    // of just a community version.  Additionally, MERGE commands within relationship
    // creation to create the start and end nodes if they do not yet exist do not always
    // have access to the Type label during creation, and are therefore not always found by
    // the MERGE command within entity creation.  The current workaround is to make
    // sure all entities are created before relationship creation occurs.
    //
    // TODO (adam-in-ict - INT-3750) revisit this and remove the need to walk the graph directory twice
    await iterateParsedGraphFiles(handleGraphObjectEntityFiles, pathToData);
    await iterateParsedGraphFiles(
      handleGraphObjectRelationshipFiles,
      pathToData,
    );
  } finally {
    await store.close();
  }
}
