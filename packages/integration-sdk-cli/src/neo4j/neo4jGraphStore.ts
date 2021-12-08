import { Entity, Relationship } from '@jupiterone/integration-sdk-core';

import * as neo4j from 'neo4j-driver';

export interface Neo4jGraphObjectStoreParams {
  uri: string;
  username: string;
  password: string;
}

export class Neo4jGraphStore {
  private neo4jDriver: neo4j.Driver;
  private persistedSession: neo4j.Session;
  private databaseName = 'neo4j';
  private typeList = new Set<string>();

  constructor(params: Neo4jGraphObjectStoreParams, session?: neo4j.Session) {
    if(session) {
      this.persistedSession = session;
    }
    else {
      this.neo4jDriver = neo4j.driver(
        params.uri,
        neo4j.auth.basic(params.username, params.password),
      );
    }
  }

  private async runCypherCommand(cypherCommand: string): Promise<neo4j.Result> {
    if(this.persistedSession) {
      const result = await this.persistedSession.run(cypherCommand);
      return result;
    }
    else {
      const session = this.neo4jDriver.session({
        database: this.databaseName,
        defaultAccessMode: neo4j.session.WRITE,
      });
      const result = await session.run(cypherCommand);
      await session.close();
      return result;
    }
  }

  async addEntities(newEntities: Entity[]) {
    for await (const entity of newEntities) {
      //Add constraint if not already in types
      //We check for existence in case we're ever running in an instance with
      //multiple inputs.
      if (!this.typeList.has(entity._type)) {
        await this.runCypherCommand(
          `CREATE CONSTRAINT unique_${entity._type} IF NOT EXISTS ON (n:${entity._type}) ASSERT n._key IS UNIQUE;`,
        );
        this.typeList.add(entity._type);
      }
      let propString = 'SET ';
      for (const key in entity) {
        if (key === '_rawData') {
          propString += `n.${key} = '${JSON.stringify(entity[key])}', `;
        } else if (key != '_key') { // skip _key because MERGE statement will handle it
          propString += `n.${key} = '${entity[key]}', `;
        }
      }
      propString = propString.slice(0, -2);

      const buildCommand = `MERGE (n:${entity._type} {_key: '${entity._key}'}) ${propString};`;
      await this.runCypherCommand(buildCommand);
    }
    return Promise.resolve();
  }

  async addRelationships(newRelationships: Relationship[]) {
    for await (const relationship of newRelationships) {
      const buildCommand = `
      MATCH (start {_key: '${relationship._fromEntityKey}'})
      MATCH (end {_key: '${relationship._toEntityKey}'})
      MERGE (start)-[:${relationship._type}]->(end);`;
      await this.runCypherCommand(buildCommand);
    }
    return Promise.resolve();
  }

  async close() {
    await this.neo4jDriver.close();
  }
}
