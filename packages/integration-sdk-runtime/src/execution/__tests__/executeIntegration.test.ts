import { promises as fs } from 'fs';
import { vol } from 'memfs';
import path from 'path';
import { promisify } from 'util';
import * as zlib from 'zlib';

import {
  createDirectRelationship,
  Entity,
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  IntegrationInvocationValidationFunction,
  IntegrationLogger,
  IntegrationValidationError,
  Relationship,
  RelationshipClass,
  StepResultStatus,
} from '@jupiterone/integration-sdk-core';
import { InMemoryGraphObjectStore } from '@jupiterone/integration-sdk-private-test-utils';

import * as integrationFileSystem from '../../fileSystem';
import { IntegrationLogger as IntegrationLoggerImpl } from '../../logger';
import { FlushedGraphObjectData } from '../../storage/types';
import {
  executeIntegrationInstance,
  executeIntegrationLocally,
  ExecuteIntegrationOptions,
  ExecuteIntegrationResult,
} from '../executeIntegration';
import { LOCAL_INTEGRATION_INSTANCE } from '../instance';
import { createInstanceConfiguration } from './utils/createIntegrationConfig';

const brotliDecompress = promisify(zlib.brotliDecompress);

jest.mock('fs');

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

interface FlushedGraphObjectDataWithFilePath extends FlushedGraphObjectData {
  filePath;
}

async function getSortedLocalGraphData(): Promise<
  FlushedGraphObjectDataWithFilePath[]
> {
  const flushedGraphData: FlushedGraphObjectDataWithFilePath[] = [];

  await integrationFileSystem.walkDirectory({
    path: path.join(integrationFileSystem.getRootStorageDirectory(), 'graph'),
    iteratee: async ({ filePath }) => {
      const fileData = (await fs.readFile(filePath)).toString('utf-8');

      flushedGraphData.push({
        ...JSON.parse(fileData),
        filePath,
      });
    },
  });

  return flushedGraphData
    .sort((a, b) => (a.filePath > b.filePath ? 1 : -1))
    .map((flushed) => {
      delete flushed.filePath;
      return flushed;
    });
}

export interface InstanceConfigurationData<
  TIntegrationConfig extends
    IntegrationInstanceConfig = IntegrationInstanceConfig,
> {
  validateInvocation: IntegrationInvocationValidationFunction<TIntegrationConfig>;
  instance: IntegrationInstance<TIntegrationConfig>;
  invocationConfig: IntegrationInvocationConfig<TIntegrationConfig>;
  logger: IntegrationLogger;
}

afterEach(() => {
  vol.reset();
  delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
});

describe('executeIntegrationInstance', () => {
  const executionStartedOn = Date.now();

  async function executeIntegrationInstanceWithConfig<
    TIntegrationConfig extends
      IntegrationInstanceConfig = IntegrationInstanceConfig,
  >(
    config: InstanceConfigurationData<TIntegrationConfig>,
    options: ExecuteIntegrationOptions = {},
  ) {
    return executeIntegrationInstance<TIntegrationConfig>(
      config.logger,
      config.instance,
      config.invocationConfig,
      {
        current: {
          startedOn: executionStartedOn,
        },
      },
      options,
    );
  }

  beforeEach(() => {
    jest
      .spyOn(integrationFileSystem, 'getRootStorageDirectorySize')
      .mockResolvedValue(Promise.resolve(1000));
  });

  afterEach(() => {
    delete process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
    delete process.env.DISABLE_DISK_USAGE_METRIC;
  });

  test('executes validateInvocation function if provided in config', async () => {
    const config = createInstanceConfiguration();
    await executeIntegrationInstanceWithConfig(config);

    const expectedContext: IntegrationExecutionContext = {
      instance: config.instance,
      logger: config.logger,
      executionHistory: {
        current: {
          startedOn: executionStartedOn,
        },
      },
      executionConfig: {},
    };

    expect(config.validateInvocation).toHaveBeenCalledWith(expectedContext);
  });

  test('should load executionConfig if loadExecutionConfig provided in config', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [],
        loadExecutionConfig: ({ config: instanceConfig }) => ({
          sharedCredentials: { instanceConfig },
        }),
      },
    });

    const loadExecutionConfigSpy = jest.spyOn(
      config.invocationConfig,
      'loadExecutionConfig',
    );

    await executeIntegrationInstanceWithConfig(config);

    expect(loadExecutionConfigSpy).toHaveBeenCalledWith(
      expect.objectContaining({ config: config.instance.config }),
    );
    expect(loadExecutionConfigSpy).toHaveReturnedWith({
      sharedCredentials: { instanceConfig: config.instance.config },
    });
  });

  test('logs validation error if validation fails', async () => {
    const error = new IntegrationValidationError(
      'Failed to auth with provider',
    );

    const config = createInstanceConfiguration({
      validateInvocation: jest.fn().mockRejectedValue(error),
    });

    const validationFailureSpy = jest.spyOn(config.logger, 'validationFailure');
    await expect(executeIntegrationInstanceWithConfig(config)).rejects.toThrow(
      /Failed to auth with provider/,
    );

    expect(validationFailureSpy).toHaveBeenCalledTimes(1);
    expect(validationFailureSpy).toHaveBeenCalledWith(error);
  });

  test('throws validation errors on invalid output of getStepStartStates', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        getStepStartStates: jest.fn().mockReturnValue({}),
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    const validationFailureSpy = jest.spyOn(config.logger, 'validationFailure');
    await expect(executeIntegrationInstanceWithConfig(config)).rejects.toThrow(
      /Start states not found for/,
    );
    // This error is not one the user can fix, we just crash
    expect(validationFailureSpy).not.toHaveBeenCalled();
  });

  test('returns integration step results and metadata about partial datasets', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step',
            name: 'My awesome step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.SUCCESS,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      },
    );
  });

  test('calls "afterExecution" hook when integration execution completes successfully', async () => {
    const afterExecutionFn = jest.fn().mockResolvedValueOnce(Promise.resolve());

    await executeIntegrationInstanceWithConfig(
      createInstanceConfiguration({
        invocationConfig: {
          integrationSteps: [],
          afterExecution: afterExecutionFn,
        },
      }),
    );

    const expectedContext: IntegrationExecutionContext = {
      instance: LOCAL_INTEGRATION_INSTANCE,
      logger: expect.any(IntegrationLoggerImpl),
      executionHistory: {
        current: {
          startedOn: executionStartedOn,
        },
      },
      executionConfig: {},
    };

    expect(afterExecutionFn).toHaveBeenCalledTimes(1);
    expect(afterExecutionFn).toHaveBeenCalledWith(expectedContext);
  });

  test('does not throw if "afterExecution" hook throws', async () => {
    const afterExecutionFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('expected error'));

    await executeIntegrationInstanceWithConfig(
      createInstanceConfiguration({
        invocationConfig: {
          integrationSteps: [],
          afterExecution: afterExecutionFn,
        },
      }),
    );

    const expectedContext: IntegrationExecutionContext = {
      instance: LOCAL_INTEGRATION_INSTANCE,
      logger: expect.any(IntegrationLoggerImpl),
      executionHistory: {
        current: {
          startedOn: executionStartedOn,
        },
      },
      executionConfig: {},
    };

    expect(afterExecutionFn).toHaveBeenCalledTimes(1);
    expect(afterExecutionFn).toHaveBeenCalledWith(expectedContext);
  });

  test('runs multiple dependency graphs in order and returns integration step results and metadata about partial datasets', async () => {
    const firstStepExecutionHandler = jest.fn();
    const secondStepExecutionHandler = jest.fn();
    const thirdStepExecutionHandler = jest.fn();
    const fourthStepExecutionHandler = jest.fn();

    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-fourth-step',
            name: 'My fourth step',
            entities: [
              {
                resourceName: 'The Fourth Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: fourthStepExecutionHandler,
            dependencyGraphId: '2',
          },
          {
            id: 'my-first-step',
            name: 'My first step',
            entities: [
              {
                resourceName: 'The First Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: firstStepExecutionHandler,
            dependencyGraphId: undefined, // defaults to going first
          },
          {
            id: 'my-second-step',
            name: 'My second step',
            entities: [
              {
                resourceName: 'The Second Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: secondStepExecutionHandler,
            dependencyGraphId: '1',
          },
          {
            id: 'depends-on-second-step',
            name: 'Depends on second step',
            entities: [
              {
                resourceName: 'The Third Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: thirdStepExecutionHandler,
            dependsOn: ['my-second-step'],
            dependencyGraphId: '1',
          },
        ],
        dependencyGraphOrder: ['1', '2'],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-first-step',
            name: 'My first step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.SUCCESS,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-second-step',
            name: 'My second step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.SUCCESS,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'depends-on-second-step',
            name: 'Depends on second step',
            declaredTypes: ['test'],
            dependsOn: ['my-second-step'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.SUCCESS,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-fourth-step',
            name: 'My fourth step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.SUCCESS,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      },
    );

    expect(firstStepExecutionHandler).toHaveBeenCalledBefore(
      secondStepExecutionHandler,
    );
    expect(secondStepExecutionHandler).toHaveBeenCalledBefore(
      thirdStepExecutionHandler,
    );
    expect(thirdStepExecutionHandler).toHaveBeenCalledBefore(
      fourthStepExecutionHandler,
    );
  });

  test('compresses files when INTEGRATION_FILE_COMPRESSION_ENABLED is set', async () => {
    process.env.INTEGRATION_FILE_COMPRESSION_ENABLED = '1';

    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              const fromEntity = await jobState.addEntity({
                _key: 'test',
                _type: 'test',
                _class: 'Test',
              });

              const toEntity = await jobState.addEntity({
                _key: 'test1',
                _type: 'test',
                _class: 'Test',
              });

              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.HAS,
                  from: fromEntity,
                  to: toEntity,
                }),
              );
            },
          },
        ],
      },
    });

    await executeIntegrationInstanceWithConfig(config);

    interface FlushedGraphObjectDataWithFilePath
      extends FlushedGraphObjectData {
      filePath;
    }

    const flushedGraphData: FlushedGraphObjectDataWithFilePath[] = [];

    await integrationFileSystem.walkDirectory({
      path: path.join(integrationFileSystem.getRootStorageDirectory(), 'graph'),
      iteratee: async ({ filePath }) => {
        const fileData = await fs.readFile(filePath);
        const decompressed = (await brotliDecompress(fileData)).toString(
          'utf-8',
        );
        flushedGraphData.push({
          ...JSON.parse(decompressed),
          filePath,
        });
      },
    });

    const sortedFlushedGraphData = flushedGraphData
      .sort((a, b) => {
        return a.filePath > b.filePath ? 1 : -1;
      })
      .map((flushed) => {
        delete flushed.filePath;
        return flushed;
      });

    expect(sortedFlushedGraphData).toEqual([
      {
        entities: [
          {
            _key: 'test',
            _type: 'test',
            _class: 'Test',
          },
          {
            _key: 'test1',
            _type: 'test',
            _class: 'Test',
          },
        ],
      },
      {
        relationships: [
          {
            _key: 'test|has|test1',
            _type: 'test_has_',
            _class: 'HAS',
            _fromEntityKey: 'test',
            _toEntityKey: 'test1',
            displayName: 'HAS',
          },
        ],
      },
    ]);
  });

  test('should call "beforeAddEntity" hook if provided to config', async () => {
    const defaultDisplayName = 'Bob';

    interface CustomIntegrationConfig extends IntegrationInstanceConfig {
      defaultDisplayName: string;
    }

    const integrationInstance: IntegrationInstance<CustomIntegrationConfig> = {
      ...LOCAL_INTEGRATION_INSTANCE,
      config: {
        ...LOCAL_INTEGRATION_INSTANCE.config,
        defaultDisplayName,
      },
    };

    const config = createInstanceConfiguration<CustomIntegrationConfig>({
      instance: integrationInstance,
      invocationConfig: {
        instanceConfigFields: {
          defaultDisplayName: {
            type: 'string',
          },
        },
        beforeAddEntity(context, entity) {
          const configDisplayName = context.instance.config.defaultDisplayName;

          return {
            ...entity,
            displayName: entity.displayName || configDisplayName,
          };
        },
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntity({
                _key: 'test',
                _type: 'test',
                _class: 'Test',
                displayName: 'Alice',
              });

              await jobState.addEntity({
                _key: 'test1',
                _type: 'test',
                _class: 'Test',
              });
            },
          },
        ],
      },
    });

    await executeIntegrationInstanceWithConfig(config);

    interface FlushedGraphObjectDataWithFilePath
      extends FlushedGraphObjectData {
      filePath;
    }

    const flushedGraphData: FlushedGraphObjectDataWithFilePath[] = [];

    await integrationFileSystem.walkDirectory({
      path: path.join(integrationFileSystem.getRootStorageDirectory(), 'graph'),
      iteratee: async ({ filePath }) => {
        const fileData = (await fs.readFile(filePath)).toString('utf-8');

        flushedGraphData.push({
          ...JSON.parse(fileData),
          filePath,
        });
      },
    });

    const sortedFlushedGraphData = flushedGraphData
      .sort((a, b) => {
        return a.filePath > b.filePath ? 1 : -1;
      })
      .map((flushed) => {
        delete flushed.filePath;
        return flushed;
      });

    expect(sortedFlushedGraphData).toEqual([
      {
        entities: [
          {
            _key: 'test',
            _type: 'test',
            _class: 'Test',
            displayName: 'Alice',
          },
          {
            _key: 'test1',
            _type: 'test',
            _class: 'Test',
            displayName: 'Bob',
          },
        ],
      },
    ]);
  });

  test('should call "beforeAddRelationship" hook if provided to config', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        beforeAddRelationship(_, relationship) {
          return {
            ...relationship,
            customProp:
              typeof relationship.customProp === 'undefined'
                ? true
                : relationship.customProp,
          };
        },
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              const e1 = await jobState.addEntity({
                _key: 'test',
                _type: 'test',
                _class: 'Test',
              });

              const e2 = await jobState.addEntity({
                _key: 'test1',
                _type: 'test',
                _class: 'Test',
              });

              const e3 = await jobState.addEntity({
                _key: 'test2',
                _type: 'test',
                _class: 'Test',
              });

              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.HAS,
                  from: e2,
                  to: e1,
                }),
              );

              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.HAS,
                  from: e3,
                  to: e2,
                  properties: {
                    customProp: false,
                  },
                }),
              );
            },
          },
        ],
      },
    });

    await executeIntegrationInstanceWithConfig(config);
    const sortedLocalGraphData = await getSortedLocalGraphData();

    expect(sortedLocalGraphData).toEqual([
      {
        entities: [
          {
            _key: 'test',
            _type: 'test',
            _class: 'Test',
          },
          {
            _key: 'test1',
            _type: 'test',
            _class: 'Test',
          },
          {
            _key: 'test2',
            _type: 'test',
            _class: 'Test',
          },
        ],
      },
      {
        relationships: [
          {
            _key: 'test1|has|test',
            _type: 'test_has_',
            _class: 'HAS',
            _fromEntityKey: 'test1',
            _toEntityKey: 'test',
            displayName: 'HAS',
            customProp: true,
          },
          {
            _key: 'test2|has|test1',
            _type: 'test_has_',
            _class: 'HAS',
            _fromEntityKey: 'test2',
            _toEntityKey: 'test1',
            displayName: 'HAS',
            customProp: false,
          },
        ],
      },
    ]);
  });

  test('should call async "beforeAddRelationship" hook if provided to config', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        async beforeAddRelationship(_, relationship) {
          await sleep(50);

          return {
            ...relationship,
            customProp:
              typeof relationship.customProp === 'undefined'
                ? true
                : relationship.customProp,
          };
        },
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              const e1 = await jobState.addEntity({
                _key: 'test',
                _type: 'test',
                _class: 'Test',
              });

              const e2 = await jobState.addEntity({
                _key: 'test1',
                _type: 'test',
                _class: 'Test',
              });

              const e3 = await jobState.addEntity({
                _key: 'test2',
                _type: 'test',
                _class: 'Test',
              });

              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.HAS,
                  from: e2,
                  to: e1,
                }),
              );

              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.HAS,
                  from: e3,
                  to: e2,
                  properties: {
                    customProp: false,
                  },
                }),
              );
            },
          },
        ],
      },
    });

    await executeIntegrationInstanceWithConfig(config);
    const sortedLocalGraphData = await getSortedLocalGraphData();

    expect(sortedLocalGraphData).toEqual([
      {
        entities: [
          {
            _key: 'test',
            _type: 'test',
            _class: 'Test',
          },
          {
            _key: 'test1',
            _type: 'test',
            _class: 'Test',
          },
          {
            _key: 'test2',
            _type: 'test',
            _class: 'Test',
          },
        ],
      },
      {
        relationships: [
          {
            _key: 'test1|has|test',
            _type: 'test_has_',
            _class: 'HAS',
            _fromEntityKey: 'test1',
            _toEntityKey: 'test',
            displayName: 'HAS',
            customProp: true,
          },
          {
            _key: 'test2|has|test1',
            _type: 'test_has_',
            _class: 'HAS',
            _fromEntityKey: 'test2',
            _toEntityKey: 'test1',
            displayName: 'HAS',
            customProp: false,
          },
        ],
      },
    ]);
  });

  test('publishes disk usage metric', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    const publishMetricSpy = jest.spyOn(config.logger, 'publishMetric');
    await executeIntegrationInstanceWithConfig(config);

    expect(publishMetricSpy).toHaveBeenCalledWith({
      name: 'disk-usage',
      unit: 'Bytes',
      value: expect.any(Number),
    });
  });

  test('should not publish disk usage metric when disabled', async () => {
    process.env.DISABLE_DISK_USAGE_METRIC = '1';

    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    const publishMetricSpy = jest.spyOn(config.logger, 'publishMetric');
    await executeIntegrationInstanceWithConfig(config);

    expect(publishMetricSpy).not.toHaveBeenCalledWith({
      name: 'disk-usage',
      unit: 'Bytes',
      value: expect.any(Number),
    });
  });

  test('populates partialDatasets type for failed steps', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something broke')),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step',
            name: 'My awesome step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['test'],
          },
        },
      },
    );
  });

  test('includes types for partially successful steps in partial datasets', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_a',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something broke')),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_b',
                _class: 'Test',
              },
            ],
            relationships: [],
            dependsOn: ['my-step-a'],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            declaredTypes: ['test_a'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            dependsOn: ['my-step-a'],
            status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['test_a', 'test_b'],
          },
        },
      },
    );
  });

  test('includes partialTypes declared in subsequent step meta data when dependency failure', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_a',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something broke')),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_b',
                _class: 'Test',
              },
              {
                resourceName: 'The Test',
                _type: 'test_b2',
                _class: 'Test',
                partial: true,
              },
            ],
            relationships: [],
            dependsOn: ['my-step-a'],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            declaredTypes: ['test_a'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b', 'test_b2'],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            partialTypes: ['test_b2'],
            dependsOn: ['my-step-a'],
            status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['test_a', 'test_b2', 'test_b'],
          },
        },
      },
    );
  });

  test('includes partialTypes declared in failing step meta data', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_a',
                _class: 'Test',
              },
              {
                resourceName: 'The Test',
                _type: 'test_a2',
                _class: 'Test',
                partial: true,
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something broke')),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_b',
                _class: 'Test',
              },
            ],
            relationships: [],
            dependsOn: ['my-step-a'],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            declaredTypes: ['test_a', 'test_a2'],
            partialTypes: ['test_a2'],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            dependsOn: ['my-step-a'],
            status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['test_a2', 'test_a', 'test_b'],
          },
        },
      },
    );
  });

  test('does not include partialTypes for disabled steps', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        getStepStartStates: () => ({
          'my-step-b': { disabled: true },
          'my-step-a': { disabled: false },
        }),
        integrationSteps: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_a',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something broke')),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_b',
                _class: 'Test',
                partial: true,
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            declaredTypes: ['test_a'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: ['test_b'],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.DISABLED,
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['test_a'],
          },
        },
      },
    );
  });

  test('does not include partial data sets for disabled steps in async "getStepStartStates"', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        getStepStartStates: async () => {
          await sleep(5);

          return {
            'my-step-b': { disabled: true },
            'my-step-a': { disabled: false },
          };
        },
        integrationSteps: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_a',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something broke')),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_b',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      {
        integrationStepResults: [
          {
            id: 'my-step-a',
            name: 'My awesome step',
            declaredTypes: ['test_a'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.FAILURE,
            startTime: expect.any(Number),
            endTime: expect.any(Number),
            duration: expect.any(Number),
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: [],
            encounteredTypes: [],
            encounteredTypeCounts: expect.any(Object),
            status: StepResultStatus.DISABLED,
          },
        ],
        metadata: {
          partialDatasets: {
            types: ['test_a'],
          },
        },
      },
    );
  });

  test('clears out the storage directory prior to performing collection', async () => {
    const previousContentFilePath = path.resolve(
      integrationFileSystem.getRootStorageDirectory(),
      'graph',
      'my-test',
      'someFile.json',
    );

    vol.fromJSON({
      [previousContentFilePath]: '{ "entities": [] }',
    });

    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntity({
                _key: 'test',
                _type: 'test',
                _class: 'Test',
              });
            },
          },
        ],
      },
    });

    await executeIntegrationInstanceWithConfig(config);

    // file should no longer exist
    await expect(fs.readFile(previousContentFilePath)).rejects.toThrow(
      /ENOENT/,
    );

    // should still have written data to disk
    const files = await fs.readdir(
      integrationFileSystem.getRootStorageDirectory(),
    );
    expect(files).toHaveLength(3);
    expect(files).toEqual(
      expect.arrayContaining(['graph', 'index', 'summary.json']),
    );

    // files should not exist any more
    await expect(fs.readFile(previousContentFilePath)).rejects.toThrow(
      /ENOENT/,
    );
  });

  test('writes results to summary.json in storage directory', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
          {
            id: 'my-step-2',
            name: 'My awesome second step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test_2',
                _class: 'Test',
              },
            ],
            relationships: [],
            executionHandler: jest
              .fn()
              .mockRejectedValue(new Error('something went wrong')),
          },
        ],
      },
    });

    const expectedResults: ExecuteIntegrationResult = {
      integrationStepResults: [
        {
          id: 'my-step',
          name: 'My awesome step',
          declaredTypes: ['test'],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'my-step-2',
          name: 'My awesome second step',
          declaredTypes: ['test_2'],
          partialTypes: [],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.FAILURE,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['test_2'],
        },
      },
    };

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      expectedResults,
    );

    const writtenSummary =
      await integrationFileSystem.readJsonFromPath<ExecuteIntegrationResult>(
        path.resolve(
          integrationFileSystem.getRootStorageDirectory(),
          'summary.json',
        ),
      );

    expect(writtenSummary).toEqual(expectedResults);
  });

  test('includes step partialTypes when all success', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'Resource 1A',
                _type: 'test_1',
                _class: 'Test',
              },
              {
                resourceName: 'Resource 1B',
                _type: 'test_1b',
                _class: 'Test',
                partial: true,
              },
            ],
            relationships: [],
            executionHandler: jest.fn(),
          },
          {
            id: 'my-step-2',
            name: 'My awesome second step',
            entities: [
              {
                resourceName: 'Resource 2A',
                _type: 'test_2',
                _class: 'Test',
              },
              {
                resourceName: 'Resource 2B',
                _type: 'test_2b',
                _class: 'Test',
                partial: true,
              },
            ],
            relationships: [
              {
                sourceType: 'Resource 1A',
                targetType: 'Resource 2A',
                _type: 'test_3',
                _class: RelationshipClass.HAS,
                partial: true,
              },
            ],
            executionHandler: jest.fn(),
          },
        ],
      },
    });

    const expectedResults: ExecuteIntegrationResult = {
      integrationStepResults: [
        {
          id: 'my-step',
          name: 'My awesome step',
          declaredTypes: ['test_1', 'test_1b'],
          partialTypes: ['test_1b'],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'my-step-2',
          name: 'My awesome second step',
          declaredTypes: ['test_2', 'test_2b', 'test_3'],
          partialTypes: ['test_2b', 'test_3'],
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['test_1b', 'test_2b', 'test_3'],
        },
      },
    };

    await expect(executeIntegrationInstanceWithConfig(config)).resolves.toEqual(
      expectedResults,
    );

    const writtenSummary =
      await integrationFileSystem.readJsonFromPath<ExecuteIntegrationResult>(
        path.resolve(
          integrationFileSystem.getRootStorageDirectory(),
          'summary.json',
        ),
      );

    expect(writtenSummary).toEqual(expectedResults);
  });

  test('throws error if duplicate key is found within same step', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'a',
            name: 'a',
            entities: [
              {
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
                resourceName: '',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntities([
                {
                  _key: 'key_a',
                  _type: 'duplicate_entity',
                  _class: 'DuplicateEntity',
                },
                {
                  _key: 'key_a',
                  _type: 'duplicate_entity',
                  _class: 'DuplicateEntity',
                },
              ]);
            },
          },
        ],
      },
    });

    const response = await executeIntegrationInstanceWithConfig(config);
    expect(response).toMatchObject({
      integrationStepResults: [
        {
          encounteredTypes: ['duplicate_entity'],
          encounteredTypeCounts: expect.any(Object),
          status: 'failure',
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['duplicate_entity'],
        },
      },
    });
  });

  test('throws error if duplicate key is found across steps', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'a',
            name: 'a',
            entities: [
              {
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
                resourceName: '',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntity({
                _key: 'key_a',
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
              });
            },
          },
          {
            id: 'b',
            name: 'b',
            entities: [
              {
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
                resourceName: '',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntity({
                _key: 'key_a',
                _type: 'duplicate_entity',
                _class: 'DuplicateEntity',
              });
            },
          },
        ],
      },
    });

    const response = await executeIntegrationInstanceWithConfig(config);
    expect(response).toMatchObject({
      integrationStepResults: [
        {
          id: 'a',
          encounteredTypes: ['duplicate_entity'],
          encounteredTypeCounts: expect.any(Object),
          status: 'success',
        },
        {
          id: 'b',
          encounteredTypes: [],
          encounteredTypeCounts: expect.any(Object),
          status: 'failure',
        },
      ],
      metadata: {
        partialDatasets: {
          types: ['duplicate_entity'],
        },
      },
    });
  });

  test('allows graph object schema validation to be enabled via options', async () => {
    const config = createInstanceConfiguration();
    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

    await executeIntegrationInstanceWithConfig(config, {
      enableSchemaValidation: true,
    });

    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
  });

  test('does not turn on schema validation if enableSchemaValidation is not set', async () => {
    const config = createInstanceConfiguration();
    await executeIntegrationInstanceWithConfig(config);
    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();
  });

  test('should allow passing custom graphObjectStore', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        integrationSteps: [
          {
            id: 'my-step',
            name: 'My awesome step',
            entities: [
              {
                resourceName: 'The Test',
                _type: 'test',
                _class: 'Test',
              },
              {
                resourceName: 'The Test 1',
                _type: 'test1',
                _class: 'Test1',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              const fromEntity = await jobState.addEntity({
                _key: 'test',
                _type: 'test',
                _class: 'Test',
              });

              const toEntity = await jobState.addEntity({
                _key: 'test1',
                _type: 'test1',
                _class: 'Test1',
              });

              await jobState.addRelationship(
                createDirectRelationship({
                  _class: RelationshipClass.HAS,
                  from: fromEntity,
                  to: toEntity,
                }),
              );
            },
          },
        ],
      },
    });

    const graphObjectStore = new InMemoryGraphObjectStore();

    await executeIntegrationInstanceWithConfig(config, {
      graphObjectStore,
    });

    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    await graphObjectStore.iterateEntities(
      {
        _type: 'test',
      },
      (e) => {
        entities.push(e);
      },
    );

    await graphObjectStore.iterateEntities(
      {
        _type: 'test1',
      },
      (e) => {
        entities.push(e);
      },
    );

    await graphObjectStore.iterateRelationships(
      {
        _type: 'test_has_test1',
      },
      (r) => {
        relationships.push(r);
      },
    );

    expect(entities).toEqual([
      {
        _key: 'test',
        _type: 'test',
        _class: 'Test',
      },
      {
        _key: 'test1',
        _type: 'test1',
        _class: 'Test1',
      },
    ]);

    expect(relationships).toEqual([
      {
        _key: 'test|has|test1',
        _type: 'test_has_test1',
        _class: 'HAS',
        _fromEntityKey: 'test',
        _toEntityKey: 'test1',
        displayName: 'HAS',
      },
    ]);
  });

  test('should call results callback', async () => {
    const config = createInstanceConfiguration({
      invocationConfig: {
        collectEncounteredKeys: true,
        integrationSteps: [
          {
            id: 'hitori',
            name: 'Fetch Person 1',
            entities: [
              {
                resourceName: 'Test Person',
                _type: 'test_person_1',
                _class: 'User',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntity({
                _key: 'person_1',
                _type: 'test_person_1',
                _class: 'User',
              });
            },
          },
          {
            id: 'futari',
            name: 'Fetch Person 2',
            entities: [
              {
                resourceName: 'Test Person 2',
                _type: 'test_person_2',
                _class: 'User',
              },
            ],
            relationships: [],
            async executionHandler({ jobState }) {
              await jobState.addEntity({
                _key: 'person_2',
                _type: 'test_person_2',
                _class: 'User',
              });
            },
          },
          {
            id: 'tomodachi',
            name: 'Build person relationships',
            entities: [],
            relationships: [
              {
                sourceType: 'test_person_1',
                targetType: 'test_person_2',
                _type: 'test_person_1_has_test_person_2',
                _class: RelationshipClass.HAS,
              },
            ],
            dependsOn: ['hitori', 'futari'],
            async executionHandler({ jobState }) {
              await jobState.addRelationship(
                createDirectRelationship({
                  fromKey: 'person_1',
                  fromType: 'test_person',
                  _class: RelationshipClass.HAS,
                  toKey: 'person_2',
                  toType: 'test_person_2',
                  properties: {
                    _type: 'test_person_1_has_test_person_2',
                  },
                }),
              );
            },
          },
        ],
      },
    });

    const expectedResults: ExecuteIntegrationResult = {
      integrationStepResults: [
        {
          id: 'hitori',
          name: 'Fetch Person 1',
          declaredTypes: ['test_person_1'],
          partialTypes: [],
          encounteredTypes: ['test_person_1'],
          encounteredTypeCounts: { test_person_1: 1 },
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'futari',
          name: 'Fetch Person 2',
          declaredTypes: ['test_person_2'],
          partialTypes: [],
          encounteredTypes: ['test_person_2'],
          encounteredTypeCounts: { test_person_2: 1 },
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
        },
        {
          id: 'tomodachi',
          name: 'Build person relationships',
          declaredTypes: ['test_person_1_has_test_person_2'],
          partialTypes: [],
          encounteredTypes: ['test_person_1_has_test_person_2'],
          encounteredTypeCounts: {
            test_person_1_has_test_person_2: 1,
          },
          status: StepResultStatus.SUCCESS,
          startTime: expect.any(Number),
          endTime: expect.any(Number),
          duration: expect.any(Number),
          dependsOn: ['hitori', 'futari'],
        },
      ],
      encounteredKeys: [['person_1', 'person_2', 'person_1|has|person_2']],
      metadata: {
        partialDatasets: {
          types: [],
        },
      },
    };

    const resultsCallback = jest.fn();
    await executeIntegrationInstanceWithConfig(config, {
      resultsCallback,
    });
    expect(resultsCallback).toHaveBeenCalledOnce();
    expect(resultsCallback).toHaveBeenCalledWith(expectedResults);
  });
});

describe('executeIntegrationLocally', () => {
  const executionStartedOn = Date.now();

  beforeEach(() => {
    delete process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
  });

  test('provides generated logger and instance', async () => {
    const validateInvocation = jest.fn();

    await executeIntegrationLocally(
      {
        validateInvocation,
        integrationSteps: [],
      },
      {
        current: {
          startedOn: executionStartedOn,
        },
      },
    );

    const expectedContext: IntegrationExecutionContext = {
      instance: LOCAL_INTEGRATION_INSTANCE,
      logger: expect.any(IntegrationLoggerImpl),
      executionHistory: {
        current: {
          startedOn: executionStartedOn,
        },
      },
      executionConfig: {},
    };

    expect(validateInvocation).toHaveBeenCalledWith(expectedContext);
  });

  test('enables graph object schema validation', async () => {
    const validateInvocation = jest.fn();

    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeUndefined();

    await executeIntegrationLocally(
      {
        validateInvocation,
        integrationSteps: [],
      },
      {
        current: {
          startedOn: executionStartedOn,
        },
      },
    );

    expect(process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION).toBeDefined();
  });
});
