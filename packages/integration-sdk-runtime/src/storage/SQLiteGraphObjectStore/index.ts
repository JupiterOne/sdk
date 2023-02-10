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

export class SQLiteGraphObjectStore implements GraphObjectStore {
  private db: BetterSqlite3.Database;

  constructor(name: string) {
    const db = new Database(name);
    db.pragma('journal_mode = OFF');
    db.pragma('synchronous = OFF');
    const stmt = db.prepare(
      `CREATE TABLE integrationRun (_key text PRIMARY KEY, _type text, entityData text)`,
    );
    const res = stmt.run();
    this.db = db;
    console.log(res.changes);
  }

  async addEntities(
    stepId: string,
    newEntities: Entity[],
    onEntitiesFlushed?: ((entities: Entity[]) => Promise<void>) | undefined,
  ): Promise<void> {
    const stmt = this.db.prepare(
      'INSERT INTO integrationRun (_key, _type,entityData) VALUES (@_key, @_type, @entityData)',
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
    throw new Error('Method not implemented.');
  }

  findEntity(_key: string | undefined): Promise<Entity | undefined> {
    const stmt = this.db.prepare(
      'SELECT entityData FROM integrationRun WHERE _key = ?',
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
      'SELECT entityData FROM integrationRun WHERE _type = ?',
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
