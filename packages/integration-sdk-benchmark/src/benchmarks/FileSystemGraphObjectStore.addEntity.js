const Benchmark = require('benchmark');
const {
  FileSystemGraphObjectStore,
} = require('@jupiterone/integration-sdk-runtime');
const { createMockEntities } = require('../util/entity');

const suite = new Benchmark.Suite();

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
  };
}

// --------------------------------
// ---------- TEST SETUP ----------
// Prepare test contexts _before_ the actual tests run, so that our benchmarks
// will _not_ include any significant setup time
const testContextWithOneHundredThousandEntities = createBenchmarkContext({
  numNewEntities: 100000,
});
// -------- END TEST SETUP --------
// --------------------------------

suite
  .add(
    'FileSystemGraphObjectStore#addEntity 100_000 Entities',
    async function () {
      const fileSystemGraphObjectStore = createFileSystemGraphObjectStore(
        testContextWithOneHundredThousandEntities.fileSystemGraphObjectStoreParams,
      );

      await fileSystemGraphObjectStore.addEntities(
        testContextWithOneHundredThousandEntities.stepId,
        testContextWithOneHundredThousandEntities.newEntities,
      );
    },
  )
  .on('cycle', function (event) {
    console.log(String(event.target));
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  // run async
  .run({ async: true });
