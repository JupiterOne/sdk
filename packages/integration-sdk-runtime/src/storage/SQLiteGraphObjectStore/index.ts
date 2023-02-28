import {
  Entity,
  GetIndexMetadataForGraphObjectTypeParams,
  GraphObjectFilter,
  GraphObjectIndexMetadata,
  GraphObjectIteratee,
  GraphObjectStore,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { InMemoryGraphObjectStore } from '../memory';
import { randomUUID } from 'crypto';

export interface SQLiteGraphObjectStoreParams {
  name?: string;
  graphObjectBufferThreshold?: number;
}

export class SQLiteGraphObjectStore implements GraphObjectStore {
  private db: BetterSqlite3.Database;
  private localGraphObjectStore: InMemoryGraphObjectStore;
  private readonly graphObjectBufferThreshold: number;

  constructor(params?: SQLiteGraphObjectStoreParams) {
    this.localGraphObjectStore = new InMemoryGraphObjectStore();
    this.graphObjectBufferThreshold =
      params?.graphObjectBufferThreshold || 1000;

    const dbName = params?.name || randomUUID();

    const db = new Database(dbName);
    db.pragma('journal_mode = OFF');
    db.pragma('synchronous = OFF');
    const createEntityTable = db.prepare(
      `CREATE TABLE entities (_key text PRIMARY KEY, _type text, entityData text)`,
    );
    const createRelationshipsTable = db.prepare(
      `CREATE TABLE relationships (_key text PRIMARY KEY, _type text, relationshipData text)`,
    );
    createEntityTable.run();
    createRelationshipsTable.run();
    this.db = db;
  }

  async addEntities(
    stepId: string,
    newEntities: Entity[],
    onEntitiesFlushed?: ((entities: Entity[]) => Promise<void>) | undefined,
  ): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO entities (_key, _type, entityData) VALUES (@_key, @_type, @entityData)',
    );
    const many = this.db.transaction((entities) => {
      for (const entity of entities)
        stmt.run({
          _key: entity._key,
          _type: entity._type,
          entityData: JSON.stringify(entity),
        });
    });

    return new Promise((resolve, reject) => {
      try {
        many(newEntities);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  addRelationships(
    stepId: string,
    newRelationships: Relationship[],
    onRelationshipsFlushed?:
      | ((relationships: Relationship[]) => Promise<void>)
      | undefined,
  ): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO entities (_key, _type,entityData) VALUES (@_key, @_type, @entityData)',
    );

    const many = this.db.transaction((relationships) => {
      for (const relationship of relationships)
        stmt.run({
          _key: relationship._key,
          _type: relationship._type,
          entityData: JSON.stringify(relationship),
        });
    });

    return new Promise((resolve, reject) => {
      try {
        many(newRelationships);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  async findEntity(_key: string | undefined): Promise<Entity | undefined> {
    if (!_key) {
      return;
    }

    const stmt = this.db.prepare(
      'SELECT entityData FROM entities WHERE _key = ?',
    );
    return new Promise((resolve, reject) => {
      try {
        const entity = stmt.get(_key);
        const p = JSON.parse(entity.entityData);
        resolve(p);
      } catch (err) {
        reject(err);
      }
    });
  }

  async iterateEntities<T extends Entity = Entity>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void> {
    const stmt = this.db.prepare(
      'SELECT entityData FROM entities WHERE _type = ?',
    );

    try {
      for (const entity of stmt.iterate(filter._type)) {
        const p = JSON.parse(entity.entityData);
        await iteratee(p);
      }
    } catch (err) {
      return Promise.reject(err);
    }
    return;
  }

  iterateRelationships<T extends Relationship = Relationship>(
    filter: GraphObjectFilter,
    iteratee: GraphObjectIteratee<T>,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  flush(
    onEntitiesFlushed?: ((entities: Entity[]) => Promise<void>) | undefined,
    onRelationshipsFlushed?:
      | ((relationships: Relationship[]) => Promise<void>)
      | undefined,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getIndexMetadataForGraphObjectType?:
    | ((
        params: GetIndexMetadataForGraphObjectTypeParams,
      ) => GraphObjectIndexMetadata | undefined)
    | undefined;
}
