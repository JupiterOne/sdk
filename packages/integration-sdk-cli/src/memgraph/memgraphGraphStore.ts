import { Entity, Relationship } from '@jupiterone/integration-sdk-core';
import {
  sanitizeValue,
  buildPropertyParameters,
  sanitizePropertyName,
  getFromTypeLabel,
  getToTypeLabel,
} from './memgraphUtilities';

import * as memgraph from 'neo4j-driver';

export interface MemgraphGraphObjectStoreParams {
  uri: string;
  username: string;
  password: string;
  integrationInstanceID: string;
  session?: memgraph.Session;
  database?: string;
}

export class MemgraphGraphStore {
  private memgraphDriver: memgraph.Driver;
  private persistedSession: memgraph.Session;
  private databaseName = 'memgraph';
  private typeList = new Set<string>();
  private integrationInstanceID: string;

  constructor(params: MemgraphGraphObjectStoreParams) {
    if (params.session) {
      this.persistedSession = params.session;
    } else {
      this.memgraphDriver = memgraph.driver(
        params.uri,
        memgraph.auth.basic(params.username, params.password),
      );
    }
    this.integrationInstanceID = params.integrationInstanceID;
    if (params.database) {
      this.databaseName = params.database;
    }
  }

  private async runCypherCommand(
    cypherCommand: string,
    cypherParameters?: any,
  ): Promise<memgraph.Result> {
    if (this.persistedSession) {
      const result = await this.persistedSession.run(cypherCommand);
      return result;
    } else {
      const session = this.memgraphDriver.session({
        database: this.databaseName,
        defaultAccessMode: memgraph.session.WRITE,
      });
      const result = await session.run(cypherCommand, cypherParameters);
      await session.close();
      return result;
    }
  }

  async addEntities(newEntities: Entity[]) {
    const nodeAlias: string = 'entityNode';
    const promiseArray: Promise<memgraph.Result>[] = [];
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
      if (!this.typeList.has(entity._type)) {
        await this.runCypherCommand(`CREATE INDEX ON :${entity._type}(_key);`);
        await this.runCypherCommand(`CREATE INDEX ON :${entity._type}(_integrationInstanceID);`);
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
    const promiseArray: Promise<memgraph.Result>[] = [];
    for (const relationship of newRelationships) {
      const relationshipAlias: string = 'relationship';
      const propertyParameters = buildPropertyParameters(relationship);

      let startEntityKey = '';
      let endEntityKey = '';

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

  async wipeInstanceIdData() {
    const wipeCypherCommand = `MATCH (n {_integrationInstanceID: '${this.integrationInstanceID}'}) DETACH DELETE n`;
    await this.runCypherCommand(wipeCypherCommand);
  }

  async wipeDatabase() {
    const wipeCypherCommand = `MATCH (n) DETACH DELETE n`;
    await this.runCypherCommand(wipeCypherCommand);
  }

  async close() {
    await this.memgraphDriver.close();
  }
}
