import {
  Entity,
  ExplicitRelationship,
  Relationship,
} from '@jupiterone/integration-sdk-core';
import { InMemoryGraphObjectStore } from './memory';
import { v4 as uuid } from 'uuid';

function createTestEntity(partial?: Partial<Entity>): Entity {
  return {
    _key: uuid(),
    _class: uuid(),
    _type: uuid(),
    [uuid()]: uuid(),
    ...partial,
  };
}

function createTestRelationship(
  partial?: Partial<ExplicitRelationship>,
): ExplicitRelationship {
  return {
    _key: uuid(),
    _toEntityKey: uuid(),
    _fromEntityKey: uuid(),
    _class: uuid(),
    _type: uuid(),
    [uuid()]: uuid(),
    ...partial,
  };
}

async function collectEntitiesByType(
  store: InMemoryGraphObjectStore,
  _type: string,
): Promise<Entity[]> {
  const entities: Entity[] = [];

  await store.iterateEntities({ _type }, (e) => {
    entities.push(e);
  });

  return entities;
}

async function collectRelationshipsByType(
  store: InMemoryGraphObjectStore,
  _type: string,
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  await store.iterateRelationships({ _type }, (r) => {
    relationships.push(r);
  });

  return relationships;
}

describe('#InMemoryGraphObjectStore', () => {
  test('should allow adding entities and finding by _key', () => {
    const store = new InMemoryGraphObjectStore();

    const e1 = createTestEntity();
    const e2 = createTestEntity();
    store.addEntities(uuid(), [e1, e2]);

    expect(store.findEntity(e1._key)).toEqual(e1);
    expect(store.findEntity(e2._key)).toEqual(e2);
  });

  test('should add entities to same _type map if already exists', async () => {
    const store = new InMemoryGraphObjectStore();

    const _type = uuid();
    const e1 = createTestEntity({ _type });
    const e2 = createTestEntity({ _type });

    store.addEntities(uuid(), [e1]);
    store.addEntities(uuid(), [e2]);

    expect(await collectEntitiesByType(store, _type)).toEqual([e1, e2]);
  });

  test('should add relationships to same _type map if already exists', async () => {
    const store = new InMemoryGraphObjectStore();

    const _type = uuid();
    const r1 = createTestRelationship({ _type });
    const r2 = createTestRelationship({ _type });

    store.addRelationships(uuid(), [r1]);
    store.addRelationships(uuid(), [r2]);

    expect(await collectRelationshipsByType(store, _type)).toEqual([r1, r2]);
  });

  test('should allow iterating entities', async () => {
    const store = new InMemoryGraphObjectStore();

    const e1 = createTestEntity();
    const e2 = createTestEntity();
    store.addEntities(uuid(), [e1, e2]);

    expect(await collectEntitiesByType(store, e1._type)).toEqual([e1]);
    expect(await collectEntitiesByType(store, e2._type)).toEqual([e2]);
  });

  test('should not throw if iterating entity _type that does not exist', async () => {
    const store = new InMemoryGraphObjectStore();
    expect(await collectEntitiesByType(store, uuid())).toEqual([]);
  });

  test('should not throw if iterating relationship _type that does not exist', async () => {
    const store = new InMemoryGraphObjectStore();
    expect(await collectRelationshipsByType(store, uuid())).toEqual([]);
  });

  test('should allow adding relationships and iterating by _type', async () => {
    const store = new InMemoryGraphObjectStore();

    const r1 = createTestRelationship();
    const r2 = createTestRelationship();
    store.addRelationships(uuid(), [r1, r2]);

    expect(await collectRelationshipsByType(store, r1._type)).toEqual([r1]);
    expect(await collectRelationshipsByType(store, r2._type)).toEqual([r2]);
  });

  test('should return "undefined" if entity not found', () => {
    const store = new InMemoryGraphObjectStore();
    expect(store.findEntity(uuid())).toEqual(undefined);
  });

  test('should allow collecting entities by step', () => {
    const store = new InMemoryGraphObjectStore();

    const step1 = uuid();
    const e1 = createTestEntity();
    const e2 = createTestEntity();
    store.addEntities(step1, [e1, e2]);

    const step2 = uuid();
    const e3 = createTestEntity();
    const e4 = createTestEntity();
    store.addEntities(step2, [e3, e4]);

    const collected = store.collectEntitiesByStep();
    expect(collected.size).toEqual(2);
    expect(collected.get(step1)).toEqual([e1, e2]);
    expect(collected.get(step2)).toEqual([e3, e4]);
  });

  test('should allow collecting relationships by step', () => {
    const store = new InMemoryGraphObjectStore();

    const step1 = uuid();
    const r1 = createTestRelationship();
    const r2 = createTestRelationship();
    store.addRelationships(step1, [r1, r2]);

    const step2 = uuid();
    const r3 = createTestRelationship();
    const r4 = createTestRelationship();
    store.addRelationships(step2, [r3, r4]);

    const collected = store.collectRelationshipsByStep();
    expect(collected.size).toEqual(2);
    expect(collected.get(step1)).toEqual([r1, r2]);
    expect(collected.get(step2)).toEqual([r3, r4]);
  });

  test('should get correct total entity and relationship counts', () => {
    const store = new InMemoryGraphObjectStore();

    const e1 = createTestEntity();
    const e2 = createTestEntity();
    const r1 = createTestRelationship();
    const r2 = createTestRelationship();

    store.addEntities(uuid(), [e1, e2]);
    store.addRelationships(uuid(), [r1, r2]);

    expect(store.getTotalEntityItemCount()).toEqual(2);
    expect(store.getTotalRelationshipItemCount()).toEqual(2);
  });

  test('should delete only selected entities when flushing', () => {
    const store = new InMemoryGraphObjectStore();

    const e1 = createTestEntity();
    const e2 = createTestEntity();

    store.addEntities(uuid(), [e1, e2]);
    store.flushEntities([e1]);

    expect(store.findEntity(e1._key)).toEqual(undefined);
    expect(store.findEntity(e2._key)).toEqual(e2);
    expect(store.getTotalEntityItemCount()).toEqual(1);
  });

  test('should delete only selected relationships when flushing', async () => {
    const store = new InMemoryGraphObjectStore();

    const r1 = createTestRelationship();
    const r2 = createTestRelationship();

    store.addRelationships(uuid(), [r1, r2]);
    store.flushRelationships([r1]);

    expect(await collectRelationshipsByType(store, r1._type)).toEqual([]);
    expect(await collectRelationshipsByType(store, r2._type)).toEqual([r2]);
    expect(store.getTotalRelationshipItemCount()).toEqual(1);
  });
});
