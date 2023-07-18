import {
  AfterAddEntityHookFunction,
  AfterAddRelationshipHookFunction,
  Entity,
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
  Relationship,
  StepExecutionContext,
  StepResultStatus,
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
import {
  publishEntitiesCollectedMetric,
  publishMappedRelationshipsCollectedMetric,
  publishRelationshipsCollectedMetric,
  timeOperation,
} from '../metrics';
import { FileSystemGraphObjectStore, GraphObjectStore } from '../storage';
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
import { DuplicateKeyTracker } from './duplicateKeyTracker';
import { getIngestionSourceStepStartStates } from './utils/getIngestionSourceStepStartStates';
import {
  shutdown,
  withObservabilityFunction,
  addSpanAttributes,
} from '@jupiterone/platform-sdk-observability/src/telemetry';

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
  await shutdown();

  unregisterIntegrationLoggerEventHandlers(registeredEventListeners);
  return result;
}

/**
 * Starts execution of an integration instance.
 */
export const executeIntegrationInstance = withObservabilityFunction({
  spanName: 'integration-sdk-runtime.executeIntegrationInstance',
  run: fnExecuteIntegrationInstance,
});

async function fnExecuteIntegrationInstance<
  TIntegrationConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
>(
  logger: IntegrationLogger,
  instance: IntegrationInstance<TIntegrationConfig>,
  config: IntegrationInvocationConfig<TIntegrationConfig>,
  executionHistory: ExecutionHistory,
  options: ExecuteIntegrationOptions = {},
): Promise<ExecuteIntegrationResult> {
  addSpanAttributes({
    j1AccountId: instance.accountId,
    integrationDefinitionId: instance.integrationDefinitionId,
    integrationInstsanceId: instance.id,
  });

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

      const configStepStartStates =
        (await config.getStepStartStates?.(context)) ??
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
        afterAddEntity: createAfterAddEntityInternalHook(logger),
        afterAddRelationship: createAfterAddRelationshipInternalHook(logger),
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
        if (
          step.status === StepResultStatus.SUCCESS &&
          undeclaredTypes.length
        ) {
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

/**
 * Internal hook called after an entity has been fully added to the job state.
 * This hook publishes a count custom metric for the entity added.
 */
function createAfterAddEntityInternalHook<
  TExecutionContext extends ExecutionContext,
>(logger: IntegrationLogger): AfterAddEntityHookFunction<TExecutionContext> {
  return (_: TExecutionContext, e: Entity) => {
    publishEntitiesCollectedMetric({
      logger,
      entityType: e._type,
    });

    return e;
  };
}

/**
 * Internal hook called after a relationship has been fully added to the job
 * state. This hook publishes a count custom metric for the relationship added.
 */
function createAfterAddRelationshipInternalHook<
  TExecutionContext extends ExecutionContext,
>(
  logger: IntegrationLogger,
): AfterAddRelationshipHookFunction<TExecutionContext> {
  return (_: TExecutionContext, r: Relationship) => {
    if (r._mapping) {
      publishMappedRelationshipsCollectedMetric({
        logger,
        relationshipType: r._type,
      });
    } else {
      publishRelationshipsCollectedMetric({
        logger,
        relationshipType: r._type,
      });
    }

    return r;
  };
}
