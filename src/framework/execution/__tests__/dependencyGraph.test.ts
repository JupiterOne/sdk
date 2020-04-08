import { v4 as uuid } from 'uuid';
import times from 'lodash/times';
import waitForExpect from 'wait-for-expect';

import { FileSystemJobState } from '../../jobState';

import {
  buildStepDependencyGraph,
  executeStepDependencyGraph,
} from '../dependencyGraph';

import { IntegrationStep, IntegrationStepResultStatus } from '../types';

describe('buildStepDependencyGraph', () => {
  test('should throw an error if a circular dependency is created', () => {
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
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
        types: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
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
        types: [],
        dependsOn: ['b'],
        executionHandler: jest.fn(),
      },
      {
        id: 'b',
        name: 'b',
        types: [],
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
  test('executionHandler should have access to "jobState" object', async () => {
    const executionHandlerSpy = jest.fn();

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: executionHandlerSpy,
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    await executeStepDependencyGraph(graph);

    expect(executionHandlerSpy).toHaveBeenCalledTimes(1);
    const args = executionHandlerSpy.mock.calls[0][0];
    expect(args.jobState).toBeInstanceOf(FileSystemJobState);
  });

  test('should perform a flush of the jobState after a step was executed', async () => {
    let jobStateFlushSpy;

    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: ({ jobState }) => {
          jobStateFlushSpy = jest.spyOn(jobState, 'flush');
        },
      },
    ];

    const graph = buildStepDependencyGraph(steps);
    await executeStepDependencyGraph(graph);

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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    const executionPromise = executeStepDependencyGraph(graph);

    // wait for spyA to have been called
    await waitForExpect(() => {
      expect(spyA).toHaveBeenCalledTimes(1);
    });

    // ensure spyB has not been called yet
    expect(spyB).toHaveBeenCalledTimes(0);

    resolveSpyA();

    // expect spyB to eventually be called
    await waitForExpect(() => {
      expect(spyB).toHaveBeenCalledTimes(1);
    });

    await executionPromise;
  });

  test('executes all leaf steps concurrently', async () => {
    const resolvers: Function[] = [];

    const testData = times(50, () => {
      const spy = jest.fn(
        (): Promise<void> =>
          new Promise((resolve) => {
            resolvers.push(resolve);
          }),
      );

      const step: IntegrationStep = {
        id: uuid(),
        name: uuid(),
        types: [],
        executionHandler: spy,
      };

      return { step, spy };
    });

    const steps = testData.map((d) => d.step);
    const spies = testData.map((d) => d.spy);

    const graph = buildStepDependencyGraph(steps);

    const executionPromise = executeStepDependencyGraph(graph);

    // wait for all spies to have been called
    await waitForExpect(() => {
      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
    });

    resolvers.forEach((resolve) => resolve());

    await executionPromise;
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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    const result = await executeStepDependencyGraph(graph);
    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        types: [],
        status: IntegrationStepResultStatus.SUCCESS,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        status: IntegrationStepResultStatus.FAILURE,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        status:
          IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
      },
    ]);

    expect(spyA).toHaveBeenCalledTimes(1);
    expect(spyB).toHaveBeenCalledTimes(1);
    expect(spyC).toHaveBeenCalledTimes(1);

    expect(spyA).toHaveBeenCalledBefore(spyB);
    expect(spyB).toHaveBeenCalledBefore(spyC);
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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    const result = await executeStepDependencyGraph(graph);
    expect(result).toEqual([
      {
        id: 'a',
        name: 'a',
        types: [],
        status: IntegrationStepResultStatus.FAILURE,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        status:
          IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        status:
          IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyC,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(graph);

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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['c'],
        executionHandler: spyD,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(graph);

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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['b', 'c', 'e'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        types: [],
        executionHandler: spyE,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(graph);

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
    const steps: IntegrationStep[] = [
      {
        id: 'a',
        name: 'a',
        types: [],
        executionHandler: spyA,
      },
      {
        id: 'b',
        name: 'b',
        types: [],
        executionHandler: spyB,
      },
      {
        id: 'c',
        name: 'c',
        types: [],
        dependsOn: ['a', 'b'],
        executionHandler: spyC,
      },
      {
        id: 'd',
        name: 'd',
        types: [],
        dependsOn: ['b'],
        executionHandler: spyD,
      },
      {
        id: 'e',
        name: 'e',
        types: [],
        dependsOn: ['c', 'd'],
        executionHandler: spyE,
      },
    ];

    const graph = buildStepDependencyGraph(steps);

    await executeStepDependencyGraph(graph);

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
});
