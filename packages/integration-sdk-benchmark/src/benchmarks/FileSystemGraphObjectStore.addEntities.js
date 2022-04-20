const Benchmark = require('benchmark');
const {
  FileSystemGraphObjectStore,
} = require('@jupiterone/integration-sdk-runtime');
const { createMockEntities } = require('../util/entity');
const { createEventCollector } = require('../util/eventCollector');

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
const inputSizes = [100, 1000, 10000, 100000];

const eventCollector = createEventCollector();

const suite = new Benchmark.Suite();

for (const size of inputSizes) {
  // --------------------------------
  // ---------- TEST SETUP ----------
  // Prepare test contexts _before_ the actual tests run, so that our benchmarks
  // will _not_ include any significant setup time
  const context = createBenchmarkContext({
    numNewEntities: size,
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
  };

  // Add the test function to the benchmark
  suite.add(
    `FileSystemGraphObjectStore#addEntities ${size.toString()} Entities`,
    fn,
  );
}

suite
  .on('cycle', function (event) {
    eventCollector.addEvent(event);
  })
  .on('complete', function () {
    eventCollector.publishEvents();
  })
  .run({ async: true });
