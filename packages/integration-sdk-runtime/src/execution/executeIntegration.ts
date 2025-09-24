import {
  ExecutionContext,
  ExecutionHistory,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInstanceExecutionContext,
  IntegrationInvocationConfig,
  IntegrationLogger,
  IntegrationStepResult,
  InvocationConfig,
  PartialDatasets,
  StepExecutionContext,
  StepResultStatus,
} from '@jupiterone/integration-sdk-core';

import {
  DEFAULT_STORAGE_DIRECTORY_NAME,
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
import path from 'path';
import { createIntegrationInstanceForLocalExecution } from './instance';
import { MemoryDataStore } from './jobState';
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
import {
  DuplicateKeyTracker,
  InMemoryDuplicateKeyTracker,
} from './duplicateKeyTracker';
import { getIngestionSourceStepStartStates } from './utils/getIngestionSourceStepStartStates';

export interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  encounteredKeys?: string[][];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

export interface ExecuteIntegrationOptions {
  enableSchemaValidation?: boolean;
  graphObjectStore?: GraphObjectStore;
  createStepGraphObjectDataUploader?: CreateStepGraphObjectDataUploaderFunction;
  resultsCallback?: (results: ExecuteIntegrationResult) => Promise<void>;
  pretty?: boolean;
}

type ExecuteWithContextOptions = Pick<
  ExecuteIntegrationOptions,
  'graphObjectStore' | 'resultsCallback' | 'createStepGraphObjectDataUploader'
>;

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
    pretty: options?.pretty,
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
  TIntegrationConfig extends
    IntegrationInstanceConfig = IntegrationInstanceConfig,
>(
  logger: IntegrationLogger,
  instance: IntegrationInstance<TIntegrationConfig>,
  config: IntegrationInvocationConfig<TIntegrationConfig>,
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
  TExecutionContext extends IntegrationInstanceExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
>(
  context: TExecutionContext,
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
  options: ExecuteWithContextOptions = {},
): Promise<ExecuteIntegrationResult> {
  const { logger } = context;

  // NOTE (austinkelleher): There is a theory that there may be some issue
  // with the disk publishing metric code causing the process to hang.
  const shouldPublishDiskUsageMetric = !process.env.DISABLE_DISK_USAGE_METRIC;

  logger.info(
    {
      compressionEnabled: isCompressionEnabled(),
    },
    'Starting execution with config...',
  );

  let diskUsagePublishInterval: NodeJS.Timeout | undefined;
  let executionComplete = false;

  function createDiskUsagePublishInterval() {
    return setInterval(() => {
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
  }

  try {
    if (shouldPublishDiskUsageMetric) {
      await tryPublishDiskUsageMetric(context);
    }

    try {
      await removeStorageDirectory();

      try {
        await config.validateInvocation?.(context);
      } catch (err) {
        logger.validationFailure(err);
        throw err;
      }

      const stepStartStatesInConfig =
        await config.getStepStartStates?.(context);

      const configStepStartStates =
        stepStartStatesInConfig ??
        getDefaultStepStartStates(config.integrationSteps);

      validateStepStartStates(config.integrationSteps, configStepStartStates);

      const stepStartStates = getIngestionSourceStepStartStates({
        integrationSteps: config.integrationSteps,
        configStepStartStates,
        disabledSources: context.instance?.disabledSources?.map(
          (source) => source.ingestionSourceId,
        ),
      });

      if (shouldPublishDiskUsageMetric) {
        diskUsagePublishInterval = createDiskUsagePublishInterval();
      }

      const {
        graphObjectStore = new FileSystemGraphObjectStore({
          logger,
        }),
        createStepGraphObjectDataUploader,
        resultsCallback,
      } = options;

      let duplicateKeyTracker: DuplicateKeyTracker =
        new InMemoryDuplicateKeyTracker(config.normalizeGraphObjectKey);

      if (process.env.USE_ON_DISK_DKT) {
        // conditionally require so the dependency can remain optional
        try {
          const {
            OnDiskDuplicateKeyTracker,
          } = require('./onDiskDuplicateKeyTracker');
          duplicateKeyTracker = new OnDiskDuplicateKeyTracker({
            filepath: path.join(
              process.cwd(),
              DEFAULT_STORAGE_DIRECTORY_NAME,
              'key-tracker.db',
            ),
          });
        } catch (err) {
          logger.warn(
            { err },
            'Tried to require OnDiskDuplicateKeyTracker, but failed. Falling back to InMemoryDuplicateKeyTracker',
          );
        }
      }

      const integrationStepResults = await executeSteps({
        executionContext: context,
        integrationSteps: config.integrationSteps,
        stepStartStates,
        stepConcurrency: config.stepConcurrency,
        duplicateKeyTracker,
        graphObjectStore,
        dataStore: new MemoryDataStore(),
        createStepGraphObjectDataUploader,
        beforeAddEntity: config.beforeAddEntity,
        beforeAddRelationship: config.beforeAddRelationship,
        afterAddEntity: undefined,
        afterAddRelationship: undefined,
        dependencyGraphOrder: config.dependencyGraphOrder,
        executionHandlerWrapper: config.executionHandlerWrapper,
      });

      const partialDatasets = determinePartialDatasetsFromStepExecutionResults(
        integrationStepResults,
      );

      const summary: ExecuteIntegrationResult = {
        integrationStepResults,
        encounteredKeys: config.collectEncounteredKeys
          ? duplicateKeyTracker.getEncounteredKeys()
          : undefined,
        metadata: {
          partialDatasets,
        },
      };

      await writeJsonToPath({
        path: 'summary.json',
        data: summary,
      });

      if (resultsCallback != null) {
        try {
          await resultsCallback(summary);
        } catch (err) {
          context.logger.warn(
            err,
            'Unable to run results callback for integration job',
          );
        }
      }

      processDeclaredTypesDiff(summary, (step, undeclaredTypes) => {
        if (
          step.status === StepResultStatus.SUCCESS &&
          undeclaredTypes.length
        ) {
          context.logger.error(
            { undeclaredTypes, stepId: step.id },
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

      if (shouldPublishDiskUsageMetric) {
        await tryPublishDiskUsageMetric(context);
      }
    }
  } finally {
    if (config?.afterExecution) {
      try {
        await config.afterExecution(context);
      } catch (err) {
        // NOTE (austinkelleher): We should not hard fail when the
        // "afterExecution" hook throws. This hook is typically used for things
        // like closing out clients.
        context.logger.error({ err }, 'Error triggering "afterExecution" hook');
      }
    }
  }
}
