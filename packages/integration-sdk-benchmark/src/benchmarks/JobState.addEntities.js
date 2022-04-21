const {
  createStepJobState,
  DuplicateKeyTracker,
  TypeTracker,
  MemoryDataStore,
} = require('@jupiterone/integration-sdk-runtime/dist/src/execution/jobState');
const {
  FileSystemGraphObjectStore,
} = require('@jupiterone/integration-sdk-runtime');
const { createMockEntities } = require('../util/entity');
const { createEventCollector } = require('../util/eventCollector');
const Benchmark = require('benchmark');

const eventCollector = createEventCollector();
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

const inputSizes = [100, 1000, 10000, 100000];

const suite = new Benchmark.Suite();

for (const size of inputSizes) {
  const context = createBenchmarkContext({
    numNewEntities: size,
  });
  const fn = async function () {
    const duplicateKeyTracker = new DuplicateKeyTracker();
    const typeTracker = new TypeTracker();
    const fsGraphObjectStore = createFileSystemGraphObjectStore({});
    const memoryDataStore = new MemoryDataStore();

    await createStepJobState({
      stepId: 'step1',
      duplicateKeyTracker: duplicateKeyTracker,
      typeTracker: typeTracker,
      graphObjectStore: fsGraphObjectStore,
      dataStore: memoryDataStore,
    }).addEntities(context.newEntities);
  };

  suite.add(`JobState#addEntities ${size.toString()}`, fn);
}

suite
  .on('cycle', function (event) {
    eventCollector.addEvent(event);
  })
  .on('complete', function () {
    eventCollector.publishEvents();
  })
  .run({
    async: true,
  });
