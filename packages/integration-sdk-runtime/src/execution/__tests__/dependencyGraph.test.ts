import { promises as fs } from 'fs';
import times from 'lodash/times';
import { vol } from 'memfs';
import { randomUUID as uuid } from 'crypto';
import waitForExpect from 'wait-for-expect';

import {
  DisabledStepReason,
  Entity,
  GraphObjectStore,
  IntegrationError,
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationLogger,
  IntegrationStep,
  IntegrationStepExecutionContext,
  JobState,
  Relationship,
  StepResultStatus,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import {
  createIntegrationLogger,
  IntegrationLogger as IntegrationLoggerImpl,
} from '../../logger';
import { FileSystemGraphObjectStore } from '../../storage';
import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from '../dependencyGraph';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';
import { MemoryDataStore } from '../jobState';
import { InMemoryDuplicateKeyTracker } from '../duplicateKeyTracker';
import { getDefaultStepStartStates } from '../step';
import {
  CreateStepGraphObjectDataUploaderFunction,
  StepGraphObjectDataUploader,
} from '../uploader';
import { FlushedGraphObjectData } from '../../storage/types';
import { createTestEntity } from '@jupiterone/integration-sdk-private-test-utils';

jest.mock('fs');

afterEach(() => vol.reset());

const executionContext: IntegrationExecutionContext = {
  logger: createIntegrationLogger({
    name: 'step logger',
    invocationConfig: {
      integrationSteps: [],
    },
  }),
  instance: LOCAL_INTEGRATION_INSTANCE,
  executionConfig: {},
  executionHistory: {
    current: {
      startedOn: Date.now(),
    },
  },
};

describe('buildStepDependencyGraph', () => {
  test('should throw an error if a circular dependency is created', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => buildStepDependencyGraph(steps)).toThrow(
      /Dependency Cycle Found/,
    );
  });

  test('should throw an error a dependency that does not exist is specified', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['c'],
        executionHandler: jest.fn(),
      },
    ];

    expect(() => buildStepDependencyGraph(steps)).toThrow(
      /Node does not exist/,
    );
  });

  test('should successfully construct a dependency graph given steps with unique ids and valid dependencies', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        executionHandler: jest.fn(),
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    expect(graph.getNodeData('a')).toEqual(steps[0]);
    expect(graph.getNodeData('b')).toEqual(steps[1]);
    expect(graph.dependenciesOf('a')).toEqual(['b']);
  });
});

describe('executeStepDependencyGraph', () => {
  async function executeSteps(
    steps: IntegrationStep[],
    stepStartStates: StepStartStates = getDefaultStepStartStates(steps),
    graphObjectStore: GraphObjectStore = new FileSystemGraphObjectStore(),
    createStepGraphObjectDataUploader?: CreateStepGraphObjectDataUploaderFunction,
  ) {
    return executeStepDependencyGraph({
      executionContext,
      inputGraph: buildStepDependencyGraph(steps),
      stepStartStates,
      duplicateKeyTracker: new InMemoryDuplicateKeyTracker(),
      graphObjectStore,
      dataStore: new MemoryDataStore(),
      createStepGraphObjectDataUploader,
    });
  }

  test('executionHandler should have access to "jobState", "logger", and "instance" objects', async () => {
    let jobState: JobState;
    let instance: IntegrationInstance<{}>;
    let logger: IntegrationLogger;

    const executionHandlerSpy = jest.fn(
      (context: IntegrationStepExecutionContext<{}>) => {
        jobState = context.jobState;
        instance = context.instance;
        logger = context.logger;
      },
    );

    await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: executionHandlerSpy,
      },
    ]);

    expect(executionHandlerSpy).toHaveBeenCalledTimes(1);

    expect(logger!).toBeInstanceOf(IntegrationLoggerImpl);
    expect(instance!).toEqual(LOCAL_INTEGRATION_INSTANCE);

    // ensure job state has expected functions
    [
      'addEntities',
      'addRelationships',
      'iterateEntities',
      'iterateRelationships',
      'flush',
    ].forEach((fn) => {
      expect(jobState[fn]).toEqual(expect.any(Function));
    });
  });

  test("waits for all of a steps's dependencies to complete prior to executing", async () => {
    let resolveA;
    const spyA = jest.fn(() => {
      return new Promise<void>((resolve) => {
        resolveA = resolve;
      });
    });

    const spyB = jest.fn(() => {
      return new Promise<void>(() => {
        // never resolve
      });
    });

    const spyC = jest.fn();

    // NOTE: This is intentionally not awaiting because the `spyB` function
    // never resolves.
    void executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_a',
            _class: 'MyClassC',
          },
        ],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_b',
            _class: 'MyClassC',
          },
        ],
        relationships: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_c',
            _class: 'MyClassC',
          },
        ],
        relationships: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
    ]);

    await waitForExpect(() => {
      expect(spyA).toHaveBeenCalledTimes(1);
      expect(spyB).toHaveBeenCalledTimes(1);
    });

    resolveA();

    // spyB never resolved, so spyC should never be called
    await expect(
      waitForExpect(() => expect(spyC).toHaveBeenCalledTimes(1), 1000),
    ).rejects.toThrow();
  });

  test('logs warning if encountered types do not match declared types', async () => {
    const workingDirectory = `/test`;
    jest.spyOn(process, 'cwd').mockReturnValue(workingDirectory);

    const warnSpy = jest.spyOn(executionContext.logger, 'warn');
    jest
      .spyOn(executionContext.logger, 'child')
      .mockReturnValue(executionContext.logger);

    const result = await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_a',
            _class: 'MyClassA',
          },
        ],
        relationships: [],
        executionHandler: async ({ jobState }) => {
          await jobState.addEntities([
            {
              _key: 'my_keys_a',
              _type: 'my_type_b',
              _class: 'MyClassA',
            },
          ]);
        },
      },
    ]);

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: ['my_type_a'],
        partialTypes: [],
        encounteredTypes: ['my_type_b'],
        encounteredTypeCounts: expect.any(Object),
        status: StepResultStatus.SUCCESS,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
    ]);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      {
        undeclaredTypes: ['my_type_b'],
      },
      'Undeclared types were detected.',
    );
  });

  test("writes data to the correct graph directory path using each step's id", async () => {
    const workingDirectory = `/test`;
    jest.spyOn(process, 'cwd').mockReturnValue(workingDirectory);

    let entityA: Entity;
    let entityB: Entity;
    let relationship: Relationship;

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_a',
            _class: 'MyClassA',
          },
        ],
        relationships: [],
        executionHandler: async ({ jobState }) => {
          await jobState.addEntities([
            {
              _key: 'my_keys_a',
              _type: 'my_type_a',
              _class: 'MyClassA',
            },
          ]);
        },
      },
      {
        id: 'b',
        name: 'b',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_b',
            _class: 'MyClassB',
          },
        ],
        relationships: [],
        executionHandler: async ({ jobState }) => {
          await jobState.addEntities([
            {
              _key: 'my_key_b',
              _type: 'my_type_b',
              _class: 'MyClassB',
            },
          ]);
        },
      },
      {
        id: 'c',
        name: 'c',
        entities: [
          {
            resourceName: 'The Class',
            _type: 'my_type_c',
            _class: 'MyClassC',
          },
        ],
        relationships: [],
        dependsOn: ['a', 'b'],
        executionHandler: async ({ jobState }) => {
          await jobState.iterateEntities({ _type: 'my_type_a' }, (e) => {
            entityA = e;
          });

          await jobState.iterateEntities({ _type: 'my_type_b' }, (e) => {
            entityB = e;
          });

          relationship = {
            _key: 'my_key_c',
            _type: 'my_type_c',
            _class: 'MyClassC',
            _fromEntityKey: entityA._key,
            _toEntityKey: entityB._key,
          };
          await jobState.addRelationships([relationship]);
        },
      },
    ];

    await executeSteps(steps);

    const stepToDataMap = {
      [steps[0].id]: {
        type: 'entities',
        data: [entityA!],
      },
      [steps[1].id]: {
        type: 'entities',
        data: [entityB!],
      },
      [steps[2].id]: {
        type: 'relationships',
        data: [relationship!],
      },
    };

    for (const [stepId, { type, data }] of Object.entries(stepToDataMap)) {
      const directory = `${workingDirectory}/.j1-integration/graph/${stepId}/${type}`;
      const files = await fs.readdir(directory);

      // each step should have just generated one file
      expect(files).toHaveLength(1);

      // each step should have just generated one file
      const writtenData = await fs.readFile(`${directory}/${files[0]}`, 'utf8');
      expect(writtenData).toEqual(JSON.stringify({ [type]: data }));
    }
  });

  test('should perform a flush of the jobState after execution completed', async () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: () => {
          return Promise.resolve();
        },
      },
    ];

    const graphObjectStore = new FileSystemGraphObjectStore();
    const jobStateFlushSpy = jest.spyOn(graphObjectStore, 'flush');

    await executeSteps(
      steps,
      getDefaultStepStartStates(steps),
      graphObjectStore,
    );

    expect(jobStateFlushSpy).toHaveBeenCalledTimes(1);
  });

  test('should hold execution of dependent steps until current step has completed', async () => {
    let resolveSpyA: Function;
    const spyA = jest.fn(
      (): Promise<void> =>
        new Promise((resolve) => {
          resolveSpyA = resolve;
        }),
    );
    const spyB = jest.fn();

    /**
     * Graph:
     * a - b
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     */
    const executionPromise = executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
    ]);

    // wait for spyA to have been called
    await waitForExpect(() => {
      expect(spyA).toHaveBeenCalledTimes(1);
    });

    // ensure spyB has not been called yet
    expect(spyB).toHaveBeenCalledTimes(0);

    resolveSpyA!();

    // expect spyB to eventually be called
    await waitForExpect(() => {
      expect(spyB).toHaveBeenCalledTimes(1);
    });

    await executionPromise;
  });

  test('executes all leaf steps concurrently', async () => {
    const resolveFunctions: Function[] = [];

    const testData = times(50, () => {
      const spy = jest.fn(
        (): Promise<void> =>
          new Promise((resolve) => {
            resolveFunctions.push(resolve);
          }),
      );

      const step: IntegrationStep = {
        id: uuid(),
        name: uuid(),
        entities: [],
        relationships: [],
        executionHandler: spy,
      };

      return { step, spy };
    });

    const steps = testData.map((d) => d.step);
    const spies = testData.map((d) => d.spy);

    let executionComplete = false;
    const executionPromise = executeSteps(steps).then(() => {
      executionComplete = true;
    });

    // wait for all spies to have been called
    await waitForExpect(() => {
      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    });

    expect(executionComplete).toEqual(false);

    resolveFunctions.forEach((resolve) => resolve());

    await executionPromise;
    expect(executionComplete).toEqual(true);
  });

  test('should mark steps failed executionHandlers with status FAILURE a dependent steps with status PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn().mockRejectedValue(new Error('oops'));
    const spyC = jest.fn();

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const result = await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ]);

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        status: StepResultStatus.SUCCESS,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
      {
        id: 'b',
        name: 'b',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        dependsOn: ['a'],
        status: StepResultStatus.FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
      {
        id: 'c',
        name: 'c',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        dependsOn: ['b'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('should mark steps with failed executionHandlers with status FAILURE and dependent steps with status PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE when step upload fails', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();

    const eA = createTestEntity();
    const eB = createTestEntity();
    const eC = createTestEntity();

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        async executionHandler({ jobState }) {
          await jobState.addEntity(eA);
          spyA();
        },
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        async executionHandler({ jobState }) {
          await jobState.addEntity(eB);
          spyB();
        },
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        async executionHandler({ jobState }) {
          await jobState.addEntity(eC);
          spyC();
        },
      },
    ];

    const stepStartStates = getDefaultStepStartStates(steps);
    const graphObjectStore = new FileSystemGraphObjectStore();

    function createPassingUploader(
      stepId: string,
      collector: FlushedGraphObjectData[],
    ): StepGraphObjectDataUploader {
      return {
        stepId,
        async enqueue(graphObjectData) {
          collector.push(graphObjectData);
          return Promise.resolve();
        },
        waitUntilUploadsComplete() {
          return Promise.resolve();
        },
      };
    }

    function createFailingUploader(
      stepId: string,
    ): StepGraphObjectDataUploader {
      return {
        stepId,
        async enqueue() {
          return Promise.resolve();
        },
        waitUntilUploadsComplete() {
          return Promise.reject(new Error('expected upload wait failure'));
        },
      };
    }

    const passingUploaderCollector: FlushedGraphObjectData[] = [];

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const result = await executeSteps(
      steps,
      stepStartStates,
      graphObjectStore,
      (stepId) => {
        if (stepId === 'b') {
          return createFailingUploader(stepId);
        } else {
          return createPassingUploader(stepId, passingUploaderCollector);
        }
      },
    );

    const expectedCollected: FlushedGraphObjectData[] = [
      {
        entities: [eA],
        relationships: [],
      },
      {
        entities: [eC],
        relationships: [],
      },
    ];

    expect(passingUploaderCollector).toEqual(expectedCollected);

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [eA._type],
        encounteredTypeCounts: expect.any(Object),
        status: StepResultStatus.SUCCESS,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
      {
        id: 'b',
        name: 'b',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [eB._type],
        encounteredTypeCounts: expect.any(Object),
        dependsOn: ['a'],
        status: StepResultStatus.FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
      {
        id: 'c',
        name: 'c',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [eC._type],
        encounteredTypeCounts: expect.any(Object),
        dependsOn: ['b'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('logs error after step fails', async () => {
    const error = new IntegrationError({
      code: 'ABC-123',
      message: 'oopsie',
    });
    let errorLogSpy;

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: ({ logger }) => {
          errorLogSpy = jest.spyOn(logger, 'error');
          throw error;
        },
      },
    ]);

    expect(errorLogSpy).toHaveBeenCalledTimes(1);
    expect(errorLogSpy).toHaveBeenCalledWith(
      { err: error, errorId: expect.any(String), code: 'ABC-123' },
      expect.stringMatching(
        new RegExp(
          `Step "a" failed to complete due to error. \\(errorCode="ABC-123", reason="oopsie"\\)$`,
        ),
      ),
    );
  });

  test('steps with dependencies resulting in PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE assume the same status', async () => {
    const spyA = jest.fn().mockRejectedValue(new Error('oops'));
    const spyB = jest.fn();
    const spyC = jest.fn();

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    const result = await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ]);

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        status: StepResultStatus.FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
      {
        id: 'b',
        name: 'b',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        dependsOn: ['a'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
      {
        id: 'c',
        name: 'c',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        dependsOn: ['b'],
        status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number),
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('should execute linear dependencyGraph in order', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();

    /**
     * Graph:
     * a - b - c
     *
     * In this situation, 'a' is the leaf node
     * 'b' depends on 'a',
     * 'c' depends on 'b'
     */
    await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
  });

  test('should handle graph steps that contain multiple dependencies', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();

    /**
     * a
     *   \
     *     c - d
     *   /
     * b
     *
     * In this situation, 'a' and 'b' are leaf nodes
     * 'c' depends on 'a' and 'b'
     */
    await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        entities: [],
        relationships: [],
        dependsOn: ['c'],
        executionHandler: spyD,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyC);
    expect(spyB).toHaveBeenCalledBefore(spyC);
    expect(spyC).toHaveBeenCalledBefore(spyD);
  });

  test('should execute step with multiple contributors last', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    /**
     *     e
     *       \
     * a - c - d
     *       /
     *     b
     *
     * In this situation, 'a', 'e', and 'b' are leaf nodes
     * 'c' depends on 'a',
     * 'd' depends on 'e', 'c', and 'b'
     */
    await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        entities: [],
        relationships: [],
        dependsOn: ['b', 'c', 'e'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        entities: [],
        relationships: [],
        executionHandler: spyE,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyC);
    expect(spyB).toHaveBeenCalledBefore(spyD);
    expect(spyC).toHaveBeenCalledBefore(spyD);
    expect(spyE).toHaveBeenCalledBefore(spyD);
  });

  test('should execute steps that have shared requirements in correct order', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    /**
     * a - c - e
     *   /    /
     * b  - d
     *
     * In this situation, 'a' and 'b' are leaf nodes
     * 'c' depends on 'a' and 'b'
     * 'd' depends on 'b'
     * 'e' depends on 'c' and 'd'
     */
    await executeSteps([
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        entities: [],
        relationships: [],
        dependsOn: ['b'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        entities: [],
        relationships: [],
        dependsOn: ['c', 'd'],
        executionHandler: spyE,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyD).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyC);

    expect(spyB).toHaveBeenCalledBefore(spyD);
    expect(spyB).toHaveBeenCalledBefore(spyC);

    expect(spyC).toHaveBeenCalledBefore(spyE);
    expect(spyD).toHaveBeenCalledBefore(spyE);
  });

  test('does not execute step if marked as disabled', async () => {
    const spyA = jest.fn();

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
    ];

    const stepStartStates = getDefaultStepStartStates(steps);
    stepStartStates['a'] = {
      disabled: true,
    };

    const result = await executeSteps(steps, stepStartStates);

    expect(spyA).toHaveBeenCalledTimes(0);

    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        declaredTypes: [],
        partialTypes: [],
        encounteredTypes: [],
        encounteredTypeCounts: expect.any(Object),
        status: StepResultStatus.DISABLED,
      },
    ]);
  });

  test('does not execute step and its dependencies if marked as disabled', async () => {
    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    /**
     *     e
     *       \
     * a - c - d
     *       /
     *     b
     *
     * In this situation, 'a', 'e', and 'b' are leaf nodes
     * 'c' depends on 'a',
     * 'd' depends on 'e', 'c', and 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        entities: [],
        relationships: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        entities: [],
        relationships: [],
        dependsOn: ['b', 'c', 'e'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        entities: [],
        relationships: [],
        executionHandler: spyE,
      },
    ];

    const stepStartStates = getDefaultStepStartStates(steps);
    stepStartStates['b'] = {
      disabled: true,
    };

    const results = await executeSteps(steps, stepStartStates);

    expect(results).toEqual(
      expect.arrayContaining([
        {
          id: 'a',
          name: 'a',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'b',
          name: 'b',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.DISABLED,
        },
        {
          id: 'c',
          name: 'c',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          dependsOn: ['a'],
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'd',
          name: 'd',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          dependsOn: ['b', 'c', 'e'],
          status: StepResultStatus.DISABLED,
        },
        {
          id: 'e',
          name: 'e',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
      ]),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyB).toHaveBeenCalledTimes(0);
    expect(spyD).toHaveBeenCalledTimes(0);

    expect(spyA).toHaveBeenCalledBefore(spyC);
  });

  test('should log parent and child skipped steps', async () => {
    // Arrange
    const stepSkipSpy = jest.spyOn(executionContext.logger, 'stepSkip');
    jest
      .spyOn(executionContext.logger, 'child')
      .mockReturnValue(executionContext.logger);

    const spyA = jest.fn();
    const spyB = jest.fn();
    const spyC = jest.fn();
    const spyD = jest.fn();
    const spyE = jest.fn();

    const parentStep = {
      id: 'b',
      name: 'b',
      entities: [],
      relationships: [],
      executionHandler: spyB,
    };

    const childStep = {
      id: 'd',
      name: 'd',
      entities: [],
      relationships: [],
      dependsOn: ['b', 'c', 'e'],
      executionHandler: spyD,
    };

    /**
     *     e
     *       \
     * a - c - d
     *       /
     *     b
     *
     * In this situation, 'a', 'e', and 'b' are leaf nodes
     * 'c' depends on 'a',
     * 'd' depends on 'e', 'c', and 'b'
     */
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        entities: [],
        relationships: [],
        executionHandler: spyA,
      },
      parentStep,
      {
        id: 'c',
        name: 'c',
        entities: [],
        relationships: [],
        dependsOn: ['a'],
        executionHandler: spyC,
      },
      childStep,
      {
        id: 'e',
        name: 'e',
        entities: [],
        relationships: [],
        executionHandler: spyE,
      },
    ];

    const stepStartStates = getDefaultStepStartStates(steps);
    stepStartStates['b'] = {
      disabled: true,
      disabledReason: DisabledStepReason.CONFIG,
    };

    // Act
    const results = await executeSteps(steps, stepStartStates);

    // Assert
    expect(results).toEqual(
      expect.arrayContaining([
        {
          id: 'a',
          name: 'a',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'b',
          name: 'b',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.DISABLED,
        },
        {
          id: 'c',
          name: 'c',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          dependsOn: ['a'],
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'd',
          name: 'd',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          dependsOn: ['b', 'c', 'e'],
          status: StepResultStatus.DISABLED,
        },
        {
          id: 'e',
          name: 'e',
          declaredTypes: [],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
      ]),
    );

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);
    expect(spyE).toHaveBeenCalledTimes(1);

    expect(spyB).toHaveBeenCalledTimes(0);
    expect(spyD).toHaveBeenCalledTimes(0);

    expect(spyA).toHaveBeenCalledBefore(spyC);

    // Assert skipStep being called for parent and child steps
    expect(stepSkipSpy).toHaveBeenCalledTimes(2);
    // Child step "d" is just skipped once even though it depends on more steps
    // As "b" is processed first, the "stepSkip" function is invoked for "d" with "b" acting as its parent.
    // However, for the remaining steps, even though "d" is a child, it has already been logged.
    expect(stepSkipSpy.mock.calls).toEqual([
      // Parent step call
      [parentStep, DisabledStepReason.CONFIG],
      // Child step call
      [childStep, DisabledStepReason.PARENT_DISABLED, { parentStep }],
    ]);
  });
});
