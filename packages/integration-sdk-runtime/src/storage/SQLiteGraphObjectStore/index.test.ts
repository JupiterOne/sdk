import {
  createTestEntities,
  createTestEntity,
  createTestRelationship,
} from '@jupiterone/integration-sdk-private-test-utils';
import times from 'lodash/times';
import { SQLiteGraphObjectStore } from '.';
import { randomUUID } from 'crypto';
import { rmSync } from 'fs';

function sqlgosWithCleanup(
  fn: (SQLiteGraphObjectStore: SQLiteGraphObjectStore) => Promise<void>,
): () => Promise<unknown> {
  return async () => {
    const name = randomUUID();
    try {
      const sqlgos = new SQLiteGraphObjectStore({ name });
      await fn(sqlgos);
    } catch (err) {
      throw err;
    } finally {
      rmSync(name);
    }
  };
}

describe('SQLiteGraphObjectStore', () => {
  describe('addEntities', () => {
    test(
      'can add basic entities successfully',
      sqlgosWithCleanup(async (sqlgos) => {
        const entities = createTestEntities(10_000);
        expect(sqlgos.addEntities('test-step-id', entities)).toResolve();
      }),
    );
  });

  describe('addRelationships', () => {
    test(
      'can add basic relationships successfully',
      sqlgosWithCleanup(async (sqlgos) => {
        const relationships = times(1_000, () => createTestRelationship());
        expect(
          sqlgos.addRelationships('test-step-id', relationships),
        ).toResolve();
      }),
    );
  });

  describe('findEntity', () => {
    test(
      'can find basic entity',
      sqlgosWithCleanup(async (sqlgos) => {
        const entity = createTestEntities(1);
        await sqlgos.addEntities('test-step-id', entity);
        const result = await sqlgos.findEntity(entity[0]._key);
        expect(result).toEqual(entity[0]);
      }),
    );

    test(
      'returns undefined when unable to find entity',
      sqlgosWithCleanup(async (sqlgos) => {
        const entities = createTestEntities(100);
        await sqlgos.addEntities('test-step-id', entities);
        expect(sqlgos.findEntity('not-a-key')).resolves.toBe(undefined);
      }),
    );
  });

  describe('iterateEntities', () => {
    test(
      'can do basic iterateEntities',
      sqlgosWithCleanup(async (sqlgos) => {
        const entities = times(100, () =>
          createTestEntity({ _type: 'test_type' }),
        );

        await sqlgos.addEntities('test-step-id', entities);
        const seenKeys = new Set();
        await sqlgos.iterateEntities({ _type: 'test_type' }, (e) => {
          seenKeys.add(e._key);
        });

        expect(entities.filter((v) => !seenKeys.has(v._key)).length).toBe(0);
      }),
    );

    test(
      'respects the filter passed in iterateEntities',
      sqlgosWithCleanup(async (sqlgos) => {
        const entities1 = times(10, () =>
          createTestEntity({ _type: 'test_type1' }),
        );
        const entities2 = times(10, () =>
          createTestEntity({ _type: 'test_type2' }),
        );

        await sqlgos.addEntities('test-step-id', entities1);
        await sqlgos.addEntities('test-step-id', entities2);
        let counter = 0;
        await sqlgos.iterateEntities({ _type: 'test_type1' }, (e) => {
          counter++;
          expect(e._type).toBe('test_type1');
        });
        expect(counter).toBe(10);

        counter = 0;
        await sqlgos.iterateEntities({ _type: 'test_type2' }, (e) => {
          counter++;
          expect(e._type).toBe('test_type2');
        });
        expect(counter).toBe(10);
      }),
    );

    test(
      'does not iterate when there are no entities for the given filter',
      sqlgosWithCleanup(async (sqlgos) => {
        const entities = times(10, () =>
          createTestEntity({ _type: 'test_type1' }),
        );
        await sqlgos.addEntities('test-step-id', entities);
        await sqlgos.iterateEntities({ _type: 'not-in-graph' }, () => {
          fail(
            'iteratee called when there are no objects matching filter in the graph',
          );
        });
      }),
    );
  });

  describe('iterateRelationships', () => {});
});
