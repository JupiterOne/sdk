const {
  SQLiteGraphObjectStore,
} = require('@jupiterone/integration-sdk-runtime/dist/src/storage/SQLiteGraphObjectStore');
const { createMockEntities } = require('../util/entity');
const fs = require('fs');

function createSQLiteGraphObjectStore(params) {
  try {
    fs.rmSync('test');
  } catch {}
  return new SQLiteGraphObjectStore('test');
}

function createBenchmarkContext(params = {}) {
  const stepId = 'abc';
  let newEntities = [];
  if (params.numNewEntities) {
    newEntities = createMockEntities(params.numNewEntities);
  }

  return {
    stepId,
    newEntities,
  };
}

void (async () => {
  try {
    const sql = createSQLiteGraphObjectStore();
    const context = createBenchmarkContext({ numNewEntities: 100_000 });
    await sql.addEntities(context.stepId, context.newEntities);
    const now = Date.now();
    for (let i = 0; i < 1000; i++) {
      const e = await sql.findEntity(context.newEntities[i]._key);
      console.log(e);
    }

    await sql.iterateEntities({ _type: context.newEntities[0]._type }, (e) => {
      console.log(e);
    });
    const time = Date.now() - now;
    console.log(`Took ${time} ms`);
  } catch (err) {
    console.log(err);
  }
})();
