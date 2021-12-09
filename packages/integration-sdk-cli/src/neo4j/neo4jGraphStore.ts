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

  private startsWithNumeric(str: string){
    return /^\d+$/.test(str);
  }

  private sanitizePropertyName(propertyName: string): string {
    let sanitizedName = '';
    if(this.startsWithNumeric(propertyName)) {
      sanitizedName += 'n';
    }
    sanitizedName += propertyName;
    sanitizedName = sanitizedName.replace(/[\s!@#$%^&*()-=+\\|'";:/?.,><`~\t\n[\]{}]/g, "_");
    return sanitizedName;
  }

  private buildPropertyString(propList, nodeName) {
    let propString = '';
    for (const key in propList) {
      if (key === '_rawData') {
        //stringify JSON in rawData so we can store it.
        propString += `${nodeName}.${key} = '${JSON.stringify(propList[key])}', `;
      } else {
        // Escape single quotes so they don't terminate strings prematurely
        const finalValue = propList[key].toString().replace(/'/gi, "\\'");
        // Sanitize out characters that aren't allowed in property names
        const propertyName = this.sanitizePropertyName(key);
        propString += `${nodeName}.${propertyName} = '${finalValue}', `;
      }
    }
    propString = propString.slice(0, -2);

    return propString;
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
      const propString = this.buildPropertyString(entity, 'n');

      const buildCommand = `MERGE (n:${entity._type} {_key: '${entity._key}'}) SET ${propString};`;
      await this.runCypherCommand(buildCommand);
    }
    return Promise.resolve();
  }

  async addRelationships(newRelationships: Relationship[]) {
    for await (const relationship of newRelationships) {
      const propString = this.buildPropertyString(relationship, 'relationship');

      //Get start and end _keys.  Will be overwritten if we're
      //working with a mapped relationship.
      let startEntityKey = relationship._fromEntityKey;
      let endEntityKey = relationship._toEntityKey;

      if(relationship._mapping) { //Mapped Relationship
        if(relationship._mapping['skipTargetCreation'] === false) {
          //Create target entity first
          const tempEntity: Entity = {
            _class: relationship._mapping['targetEntity']._class,
            //TODO, I think this key is wrong, but not sure what else to use
            _key:  relationship._key.replace(relationship._mapping['sourceEntityKey'], ''),
            _type: relationship._mapping['targetEntity']._type,
          }
          await this.addEntities([tempEntity]);
        }
        startEntityKey = relationship._mapping['sourceEntityKey'];
        // TODO, see above.  This key might also be an issue for the same reason
        endEntityKey = relationship._key.replace(relationship._mapping['sourceEntityKey'], '');
      }

      const buildCommand = `
      MATCH (start {_key: '${startEntityKey}'})
      MATCH (end {_key: '${endEntityKey}'})
      MERGE (start)-[relationship:${relationship._type}]->(end)
      SET ${propString};`;
      await this.runCypherCommand(buildCommand);
    }
    return Promise.resolve();
  }

  async close() {
    await this.neo4jDriver.close();
  }
}
