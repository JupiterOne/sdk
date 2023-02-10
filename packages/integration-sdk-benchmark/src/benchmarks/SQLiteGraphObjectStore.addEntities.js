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
  const sql = createSQLiteGraphObjectStore();
  const context = createBenchmarkContext({ numNewEntities: 1_000_000 });
  const now = Date.now();
  await sql.addEntities(context.stepId, context.newEntities);
  const time = Date.now() - now;
  console.log(
    `Took ${time} ms to add ${context.newEntities.length} new entities`,
  );
})();
