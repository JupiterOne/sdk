const {
  FileSystemGraphObjectStore,
} = require('@jupiterone/integration-sdk-runtime');
const { createMockEntities } = require('../util/entity');

function createFileSystemGraphObjectStore(params) {
  return new FileSystemGraphObjectStore(params);
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
    fileSystemGraphObjectStoreParams: { graphObjectBufferThreshold: 500 },
  };
}

// --------------------------------
// ---------- TEST SETUP ----------
// Prepare test contexts _before_ the actual tests run, so that our benchmarks
// will _not_ include any significant setup time
const context = createBenchmarkContext({
  numNewEntities: 1_000_000,
});
// -------- END TEST SETUP --------
// --------------------------------

// ---- TEST FUNCTION -------------
const fn = async function () {
  const fileSystemGraphObjectStore = createFileSystemGraphObjectStore(
    context.fileSystemGraphObjectStoreParams,
  );

  await fileSystemGraphObjectStore.addEntities(
    context.stepId,
    context.newEntities,
  );
  const now = Date.now();
  for (let i = 0; i < 1000; i++) {
    await fileSystemGraphObjectStore.findEntity(context.newEntities[i]._key);
  }
  const time = Date.now() - now;
  console.log(`Took ${time} ms`);
};

void (async () => {
  await fn();
})();
