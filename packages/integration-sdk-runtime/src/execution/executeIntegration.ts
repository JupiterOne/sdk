import {
  ExecutionContext,
  ExecutionHistory,
  IntegrationExecutionConfig,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  IntegrationLogger,
  IntegrationStepResult,
  InvocationConfig,
  PartialDatasets,
  StepExecutionContext,
  StepResultStatus,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import {
  getRootStorageDirectorySize,
  isCompressionEnabled,
  isRootStorageDirectoryPresent,
  removeStorageDirectory,
  writeJsonToPath,
} from '../fileSystem';
import {
  createIntegrationLogger,
  registerIntegrationLoggerEventHandlers,
  unregisterIntegrationLoggerEventHandlers,
} from '../logger';
import { timeOperation } from '../metrics';
import { FileSystemGraphObjectStore, GraphObjectStore } from '../storage';
import { createIntegrationInstanceForLocalExecution } from './instance';
import { DuplicateKeyTracker, MemoryDataStore } from './jobState';
import {
  determinePartialDatasetsFromStepExecutionResults,
  executeSteps,
  getDefaultStepStartStates,
} from './step';
import { CreateStepGraphObjectDataUploaderFunction } from './uploader';
import { getMaskedFields } from './utils/getMaskedFields';
import { trimStringValues } from './utils/trimStringValues';
import { validateStepStartStates } from './validation';
import { processDeclaredTypesDiff } from './utils/processDeclaredTypesDiff';

export interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

export interface ExecuteIntegrationOptions {
  enableSchemaValidation?: boolean;
  graphObjectStore?: GraphObjectStore;
  createStepGraphObjectDataUploader?: CreateStepGraphObjectDataUploaderFunction;
}

export interface ExecuteWithContextOptions {
  graphObjectStore?: GraphObjectStore;
  createStepGraphObjectDataUploader?: CreateStepGraphObjectDataUploaderFunction;
}

const THIRTY_SECONDS_STORAGE_INTERVAL_MS = 60000 / 2;

/**
 * Starts execution of an integration instance generated from local environment
 * variables.
 */
export async function executeIntegrationLocally(
  config: IntegrationInvocationConfig,
  executionHistory: ExecutionHistory,
  options?: ExecuteIntegrationOptions,
) {
  const logger = createIntegrationLogger({
    name: 'Local',
    invocationConfig: config,
    pretty: true,
  });
  const registeredEventListeners = registerIntegrationLoggerEventHandlers(
    () => logger,
  );
  const result = await executeIntegrationInstance(
    logger,
    createIntegrationInstanceForLocalExecution(config),
    config,
    executionHistory,
    {
      ...options,
      enableSchemaValidation: options?.enableSchemaValidation ?? true,
    },
  );
  unregisterIntegrationLoggerEventHandlers(registeredEventListeners);
  return result;
}

/**
 * Starts execution of an integration instance.
 */
export async function executeIntegrationInstance<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
>(
  logger: IntegrationLogger,
  instance: IntegrationInstance<TInstanceConfig>,
  config: IntegrationInvocationConfig<TInstanceConfig>,
  executionHistory: ExecutionHistory,
  options: ExecuteIntegrationOptions = {},
): Promise<ExecuteIntegrationResult> {
  if (options.enableSchemaValidation === true) {
    process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION = 'true';
  }
  const instanceWithTrimmedConfig = trimStringValues(
    instance,
    getMaskedFields(config),
  );

  return timeOperation({
    logger,
    metricName: 'duration-collect',
    operation: () =>
      executeWithContext(
        {
          instance: instanceWithTrimmedConfig,
          logger,
          executionHistory,
          executionConfig:
            config.loadExecutionConfig?.(instanceWithTrimmedConfig) || {},
        },
        config,
        options,
      ),
  });
}

function publishDiskUsageMetric<TExecutionContext extends ExecutionContext>(
  context: TExecutionContext,
  size: number,
) {
  context.logger.publishMetric({
    name: 'disk-usage',
    value: size,
    unit: 'Bytes',
  });
}

async function tryPublishDiskUsageMetric<
  TExecutionContext extends ExecutionContext,
>(context: TExecutionContext) {
  if (!(await isRootStorageDirectoryPresent())) {
    return;
  }

  publishDiskUsageMetric(context, await getRootStorageDirectorySize());
}

/**
 * Executes an integration and performs actions defined by the config
 * using context that was provided.
 */
export async function executeWithContext<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
>(
  context: TExecutionContext,
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
  options: ExecuteWithContextOptions = {},
): Promise<ExecuteIntegrationResult> {
  const { logger } = context;

  logger.info(
    {
      compressionEnabled: isCompressionEnabled(),
    },
    'Starting execution with config...',
  );

  await tryPublishDiskUsageMetric(context);

  let diskUsagePublishInterval: NodeJS.Timeout | undefined;
  let executionComplete = false;

  try {
    await removeStorageDirectory();

    try {
      await config.validateInvocation?.(context);
    } catch (err) {
      logger.validationFailure(err);
      throw err;
    }

    const stepStartStates: StepStartStates =
      (await config.getStepStartStates?.(context)) ??
      getDefaultStepStartStates(config.integrationSteps);

    validateStepStartStates(config.integrationSteps, stepStartStates);

    diskUsagePublishInterval = setInterval(() => {
      isRootStorageDirectoryPresent()
        .then((present) => {
          if (!present) return;

          return getRootStorageDirectorySize().then((size) => {
            if (executionComplete) {
              return;
            }

            publishDiskUsageMetric(context, size);
          });
        })
        .catch((err) => {
          if (executionComplete) {
            return;
          }

          context.logger.error({ err }, 'Error publishing disk-usage metric');
        });
    }, THIRTY_SECONDS_STORAGE_INTERVAL_MS);

    const {
      graphObjectStore = new FileSystemGraphObjectStore(),
      createStepGraphObjectDataUploader,
    } = options;

    const integrationStepResults = await executeSteps({
      executionContext: context,
      integrationSteps: config.integrationSteps,
      stepStartStates,
      duplicateKeyTracker: new DuplicateKeyTracker(
        config.normalizeGraphObjectKey,
      ),
      graphObjectStore,
      dataStore: new MemoryDataStore(),
      createStepGraphObjectDataUploader,
      beforeAddEntity: config.beforeAddEntity,
      beforeAddRelationship: config.beforeAddRelationship,
      dependencyGraphOrder: config.dependencyGraphOrder,
    });

    const partialDatasets = determinePartialDatasetsFromStepExecutionResults(
      integrationStepResults,
    );

    const summary: ExecuteIntegrationResult = {
      integrationStepResults,
      metadata: {
        partialDatasets,
      },
    };

    await writeJsonToPath({
      path: 'summary.json',
      data: summary,
    });

    context.logger.info(
      { collectionResult: summary },
      'Integration data collection has completed.',
    );

    processDeclaredTypesDiff(summary, (step, undeclaredTypes) => {
      if (step.status === StepResultStatus.SUCCESS && undeclaredTypes.length) {
        context.logger.error(
          { undeclaredTypes },
          `Undeclared types detected during execution. To prevent accidental data loss, please ensure that` +
            ` all known entity and relationship types are declared.`,
        );
      }
    });

    return summary;
  } finally {
    executionComplete = true;

    if (diskUsagePublishInterval) {
      clearInterval(diskUsagePublishInterval);
    }

    await tryPublishDiskUsageMetric(context);
  }
}
