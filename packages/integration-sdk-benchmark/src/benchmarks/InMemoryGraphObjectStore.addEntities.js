const Benchmark = require('benchmark');
const {
  InMemoryGraphObjectStore,
} = require('@jupiterone/integration-sdk-runtime');
const { createMockEntities } = require('../util/entity');
const { createEventCollector } = require('../util/eventCollector');

function createInMemoryGraphObjectStore(params) {
  return new InMemoryGraphObjectStore(params);
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
    const inMemoryGraphObjectStore = createInMemoryGraphObjectStore();

    await inMemoryGraphObjectStore.addEntities(
      context.stepId,
      context.newEntities,
    );
  };

  suite.add(`InMemoryGraphObjectStore#addEntities ${size.toString()}`, fn);
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
