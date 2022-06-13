import { Entity, Relationship } from '@jupiterone/integration-sdk-core';
import {
  sanitizeValue,
  buildPropertyParameters,
  sanitizePropertyName,
  getFromTypeLabel,
  getToTypeLabel,
} from './neo4jUtilities';

import * as neo4j from 'neo4j-driver';

export interface Neo4jGraphObjectStoreParams {
  uri: string;
  username: string;
  password: string;
  integrationInstanceID: string;
  session?: neo4j.Session;
}

export class Neo4jGraphStore {
  private neo4jDriver: neo4j.Driver;
  private persistedSession: neo4j.Session;
  private databaseName = 'neo4j';
  private typeList = new Set<string>();
  private integrationInstanceID: string;

  constructor(params: Neo4jGraphObjectStoreParams) {
    if (params.session) {
      this.persistedSession = params.session;
    } else {
      this.neo4jDriver = neo4j.driver(
        params.uri,
        neo4j.auth.basic(params.username, params.password),
      );
    }
    this.integrationInstanceID = params.integrationInstanceID;
  }

  private async runCypherCommand(
    cypherCommand: string,
    cypherParameters?: any,
  ): Promise<neo4j.Result> {
    if (this.persistedSession) {
      const result = await this.persistedSession.run(cypherCommand);
      return result;
    } else {
      const session = this.neo4jDriver.session({
        database: this.databaseName,
        defaultAccessMode: neo4j.session.WRITE,
      });
      const result = await session.run(cypherCommand, cypherParameters);
      // TODO (adam-in-ict) strictly speaking, using writeTransaction instead of run would be more correct and
      // potentially faster in some instances.
      // const result = await session.writeTransaction(cypherCommand, cypherParameters);
      await session.close();
      return result;
    }
  }

  async addEntities(newEntities: Entity[]) {
    const nodeAlias: string = 'entityNode';
    const promiseArray: Promise<neo4j.Result>[] = [];
    for (const entity of newEntities) {
      let classLabels = '';
      if (entity._class) {
        if (typeof entity._class === 'string') {
          classLabels += `:${sanitizePropertyName(entity._class)}`;
        } else {
          for (const className of entity._class) {
            classLabels += `:${sanitizePropertyName(className)}`;
          }
        }
      }
      // I believe we currently can't use parameters for node labels, hence the use of string
      // interpolation in the below commands.
      // Add index if not already in types.  This will optimize future
      // MATCH/MERGE calls.
      if (!this.typeList.has(entity._type)) {
        await this.runCypherCommand(
          `CREATE INDEX index_${entity._type} IF NOT EXISTS FOR (n:${entity._type}) ON (n._key, n._integrationInstanceID);`,
        );
        this.typeList.add(entity._type);
      }
      const sanitizedType = sanitizePropertyName(entity._type);
      const propertyParameters = buildPropertyParameters(entity);
      const finalKeyValue = sanitizeValue(entity._key.toString());
      const buildCommand = `
        MERGE (${nodeAlias} {_key: $finalKeyValue, _integrationInstanceID: $integrationInstanceID}) 
        SET ${nodeAlias} += $propertyParameters
        SET ${nodeAlias}:${sanitizedType}${classLabels};`;
      promiseArray.push(
        this.runCypherCommand(buildCommand, {
          propertyParameters: propertyParameters,
          finalKeyValue: finalKeyValue,
          integrationInstanceID: this.integrationInstanceID,
        }),
      );
    }
    await Promise.all(promiseArray);
  }

  async addRelationships(newRelationships: Relationship[]) {
    const promiseArray: Promise<neo4j.Result>[] = [];
    for (const relationship of newRelationships) {
      const relationshipAlias: string = 'relationship';
      const propertyParameters = buildPropertyParameters(relationship);

      let startEntityKey = '';
      let endEntityKey = '';

      //Get start and end _keys.  Will be overwritten if we're
      //working with a mapped relationship.
      if (relationship._fromEntityKey) {
        startEntityKey = sanitizeValue(relationship._fromEntityKey.toString());
      }
      if (relationship._toEntityKey) {
        endEntityKey = sanitizeValue(relationship._toEntityKey.toString());
      }

      //Attempt to get start and end types
      const startEntityTypeLabel = getFromTypeLabel(relationship);
      const endEntityTypeLabel = getToTypeLabel(relationship);

      if (relationship._mapping) {
        //Mapped Relationship
        if (relationship._mapping['skipTargetCreation'] === false) {
          const targetEntity = relationship._mapping['targetEntity'];
          //Create target entity first
          const tempEntity: Entity = {
            ...targetEntity,
            _class: targetEntity._class,
            //TODO, I think this key is wrong, but not sure what else to use
            _key: sanitizeValue(
              relationship._key.replace(
                relationship._mapping['sourceEntityKey'],
                '',
              ),
            ),
            _type: targetEntity._type,
          };
          await this.addEntities([tempEntity]);
        }
        startEntityKey = sanitizeValue(
          relationship._mapping['sourceEntityKey'],
        );
        // TODO, see above.  This key might also be an issue for the same reason
        endEntityKey = sanitizeValue(
          relationship._key.replace(
            relationship._mapping['sourceEntityKey'],
            '',
          ),
        );
      }

      const sanitizedRelationshipClass = sanitizePropertyName(
        relationship._class,
      );

      const buildCommand = `
      MERGE (start${startEntityTypeLabel} {_key: $startEntityKey, _integrationInstanceID: $integrationInstanceID})
      MERGE (end${endEntityTypeLabel} {_key: $endEntityKey, _integrationInstanceID: $integrationInstanceID})
      MERGE (start)-[${relationshipAlias}:${sanitizedRelationshipClass}]->(end)
      SET ${relationshipAlias} += $propertyParameters;`;
      promiseArray.push(
        this.runCypherCommand(buildCommand, {
          propertyParameters: propertyParameters,
          startEntityKey: startEntityKey,
          endEntityKey: endEntityKey,
          integrationInstanceID: this.integrationInstanceID,
        }),
      );
    }
    await Promise.all(promiseArray);
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
