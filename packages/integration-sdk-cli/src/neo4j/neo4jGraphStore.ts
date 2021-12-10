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
  private integrationInstanceID: string;

  constructor(instanceID: string, params: Neo4jGraphObjectStoreParams, session?: neo4j.Session) {
    if(session) {
      this.persistedSession = session;
    }
    else {
      this.neo4jDriver = neo4j.driver(
        params.uri,
        neo4j.auth.basic(params.username, params.password),
      );
    }
    this.integrationInstanceID = instanceID;
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

  private sanitizeValue(value: string): string {
    return value.replace(/'/gi, "\\'")
  }

  public buildPropertyString(propList, nodeName) {
    let propString = '';
    for (const key in propList) {
      if (key === '_rawData') {
        //stringify JSON in rawData so we can store it.
        propString += `${nodeName}.${key} = '${JSON.stringify(propList[key])}', `;
      } else {
        // Escape single quotes so they don't terminate strings prematurely
        const finalValue = this.sanitizeValue(propList[key].toString());
        // Sanitize out characters that aren't allowed in property names
        const propertyName = this.sanitizePropertyName(key);
        propString += `${nodeName}.${propertyName} = '${finalValue}', `;
      }
    }
    propString = propString.slice(0, -2);

    return propString;
  }

  async addEntities(newEntities: Entity[]) {
    for (const entity of newEntities) {
      //Add index if not already in types.  This will optimize future
      //MATCH/MERGE calls.
      if (!this.typeList.has(entity._type)) {
        await this.runCypherCommand(
          `CREATE INDEX index_${entity._type} IF NOT EXISTS FOR (n:${entity._type}) ON (n._key, n._integrationInstanceID);`,
        );
        this.typeList.add(entity._type);
      }
      const propString = this.buildPropertyString(entity, 'n');
      const finalKeyValue = this.sanitizeValue(entity._key.toString());
      const buildCommand = `
        MERGE (n {_key: '${finalKeyValue}', _integrationInstanceID: '${this.integrationInstanceID}'}) 
        SET ${propString}, n:${entity._type};`;
      await this.runCypherCommand(buildCommand);
    }
  }

  async addRelationships(newRelationships: Relationship[]) {
    for (const relationship of newRelationships) {
      const propString = this.buildPropertyString(relationship, 'relationship');

      let startEntityKey = '';
      let endEntityKey = '';
      //Get start and end _keys.  Will be overwritten if we're
      //working with a mapped relationship.
      if (relationship._fromEntityKey) {
        startEntityKey = this.sanitizeValue(relationship._fromEntityKey.toString());
      }
      if(relationship._toEntityKey) {
        endEntityKey = this.sanitizeValue(relationship._toEntityKey.toString());
      }

      if(relationship._mapping) { //Mapped Relationship
        if(relationship._mapping['skipTargetCreation'] === false) {
          //Create target entity first
          const tempEntity: Entity = {
            _class: relationship._mapping['targetEntity']._class,
            //TODO, I think this key is wrong, but not sure what else to use
            _key:  this.sanitizeValue(relationship._key.replace(relationship._mapping['sourceEntityKey'], '')),
            _type: relationship._mapping['targetEntity']._type,
          }
          await this.addEntities([tempEntity]);
        }
        startEntityKey = this.sanitizeValue(relationship._mapping['sourceEntityKey']);
        // TODO, see above.  This key might also be an issue for the same reason
        endEntityKey = this.sanitizeValue(relationship._key.replace(relationship._mapping['sourceEntityKey'], ''));
      }

      const buildCommand = `
      MATCH (start {_key: '${startEntityKey}', _integrationInstanceID: '${this.integrationInstanceID}'})
      MATCH (end {_key: '${endEntityKey}', _integrationInstanceID: '${this.integrationInstanceID}'})
      MERGE (start)-[relationship:${relationship._type}]->(end)
      SET ${propString};`;
      await this.runCypherCommand(buildCommand);
    }
  }

  // TODO, if we get to very large databases we could reach a size where
  // one or both both of the below wipe commands can't be easily executed 
  // in memory.  At that time, we should consider requiring/using the APOC 
  // library so we can use apoc.periodic.iterate.  Leaving out for now,
  // since that would further complicate the Neo4j database setup.
  async wipeInstanceIdData() {
    const wipeCypherCommand = `MATCH (n {_integrationInstanceID: '${this.integrationInstanceID}'}) DETACH DELETE n`;
    await this.runCypherCommand(wipeCypherCommand);
  }

  async wipeDatabase() {
    const wipeCypherCommand = `MATCH (n) DETACH DELETE n`;
    await this.runCypherCommand(wipeCypherCommand);
  }

  async close() {
    await this.neo4jDriver.close();
  }
}
