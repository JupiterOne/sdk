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

export interface InstanceConfigurationData<
  TIntegrationConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> {
  validateInvocation: IntegrationInvocationValidationFunction<
    TIntegrationConfig
  >;
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
    TIntegrationConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
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
    delete process.env.INTEGRATION_FILE_COMPRESSION_ENABLED;
    jest
      .spyOn(integrationFileSystem, 'getRootStorageDirectorySize')
      .mockResolvedValue(Promise.resolve(1000));
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
    };

    expect(config.validateInvocation).toHaveBeenCalledWith(expectedContext);
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
            status: StepResultStatus.SUCCESS,
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

  test('runs multiple dependency graphs in order and returns integration step results and metadata about partial datasets', async () => {

    const firstStepExecutionHandler = jest.fn()
    const secondStepExecutionHandler = jest.fn()
    const thirdStepExecutionHandler = jest.fn()
    const fourthStepExecutionHandler = jest.fn()

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
            dependencyGraphId: undefined // defaults to going first
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
            dependencyGraphId: '1'
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
            dependencyGraphId: '1'
          },
        ],
        dependencyGraphOrder: ['1', '2']
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
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'my-second-step',
            name: 'My second step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'depends-on-second-step',
            name: 'Depends on second step',
            declaredTypes: ['test'],
            dependsOn: ['my-second-step'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
          {
            id: 'my-fourth-step',
            name: 'My fourth step',
            declaredTypes: ['test'],
            partialTypes: [],
            encounteredTypes: [],
            status: StepResultStatus.SUCCESS,
          },
        ],
        metadata: {
          partialDatasets: {
            types: [],
          },
        },
      },
    );

    expect(firstStepExecutionHandler).toHaveBeenCalledBefore(secondStepExecutionHandler)
    expect(secondStepExecutionHandler).toHaveBeenCalledBefore(thirdStepExecutionHandler)
    expect(thirdStepExecutionHandler).toHaveBeenCalledBefore(fourthStepExecutionHandler)
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
            status: StepResultStatus.FAILURE,
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
            status: StepResultStatus.FAILURE,
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: [],
            encounteredTypes: [],
            dependsOn: ['my-step-a'],
            status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
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
            status: StepResultStatus.FAILURE,
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b', 'test_b2'],
            encounteredTypes: [],
            partialTypes: ['test_b2'],
            dependsOn: ['my-step-a'],
            status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
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
            status: StepResultStatus.FAILURE,
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: [],
            encounteredTypes: [],
            dependsOn: ['my-step-a'],
            status: StepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE,
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
            status: StepResultStatus.FAILURE,
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: ['test_b'],
            encounteredTypes: [],
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
            status: StepResultStatus.FAILURE,
          },
          {
            id: 'my-step-b',
            name: 'My awesome step',
            declaredTypes: ['test_b'],
            partialTypes: [],
            encounteredTypes: [],
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
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'my-step-2',
          name: 'My awesome second step',
          declaredTypes: ['test_2'],
          partialTypes: [],
          encounteredTypes: [],
          status: StepResultStatus.FAILURE,
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

    const writtenSummary = await integrationFileSystem.readJsonFromPath<
      ExecuteIntegrationResult
    >(
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
          status: StepResultStatus.SUCCESS,
        },
        {
          id: 'my-step-2',
          name: 'My awesome second step',
          declaredTypes: ['test_2', 'test_2b', 'test_3'],
          partialTypes: ['test_2b', 'test_3'],
          encounteredTypes: [],
          status: StepResultStatus.SUCCESS,
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

    const writtenSummary = await integrationFileSystem.readJsonFromPath<
      ExecuteIntegrationResult
    >(
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
          status: 'success',
        },
        {
          id: 'b',
          encounteredTypes: [],
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
