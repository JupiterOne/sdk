// import * as neo4j from 'neo4j-driver';
import * as fs from 'fs';
import * as path from 'path';
import { Neo4jGraphStore } from './neo4jGraphStore';

export async function uploadToNeo4j() {
  console.log('Uploading...');

  const graphDirectory = '.j1-integration/graph';

  if (!fs.existsSync(graphDirectory)) {
    throw new Error('ERROR: graph directory does not exist!');
  }

  console.log(`We have a process.env of `, process.env);

  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD || 'neo4j';

  const store = new Neo4jGraphStore({
    uri: neo4jUri,
    username: neo4jUser,
    password: neo4jPassword,
  });
  try {
    for await (const directory of fs.readdirSync(graphDirectory)) {
      console.log(`Scanning items in graphDirectory with ${directory}`);
      for await (const folder of fs.readdirSync(
        path.join(graphDirectory, directory),
      )) {
        console.log(`Scanning items in directory with ${folder}`);
        if (folder != 'entities' && folder != 'relationships') {
          throw new Error(
            'ERROR: Found a directory that was not an entities/relationships directory',
          );
        }
        if (folder === 'entities') {
          for await (const file of fs.readdirSync(
            path.join(graphDirectory, directory, folder),
          )) {
            console.log(`Scanning entities in folder with ${file}`);
            const entityData = JSON.parse(
              fs.readFileSync(
                path.join(graphDirectory, directory, folder, file),
                'utf-8',
              ),
            );
            await store.addEntities(entityData.entities);
          }
        } else if (folder === 'relationships') {
          for await (const file of fs.readdirSync(
            path.join(graphDirectory, directory, folder),
          )) {
            console.log(`Scanning relationships in folder with ${file}`);
            const relationshipData = JSON.parse(
              fs.readFileSync(
                path.join(graphDirectory, directory, folder, file),
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
