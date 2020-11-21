import {
  ExecutionContext,
  ExecutionHistory,
  IntegrationInstance,
  IntegrationInvocationConfig,
  IntegrationLogger,
  IntegrationStepResult,
  InvocationConfig,
  PartialDatasets,
  StepExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import {
  removeStorageDirectory,
  writeJsonToPath,
  getRootStorageDirectorySize,
  isRootStorageDirectoryPresent,
} from '../fileSystem';
import { createIntegrationLogger } from '../logger';
import { timeOperation } from '../metrics';
import { FileSystemGraphObjectStore, GraphObjectStore } from '../storage';
import { createIntegrationInstanceForLocalExecution } from './instance';
import { DuplicateKeyTracker } from './jobState';
import {
  determinePartialDatasetsFromStepExecutionResults,
  executeSteps,
  getDefaultStepStartStates,
} from './step';
import { validateStepStartStates } from './validation';

export interface ExecuteIntegrationResult {
  integrationStepResults: IntegrationStepResult[];
  metadata: {
    partialDatasets: PartialDatasets;
  };
}

interface ExecuteIntegrationOptions {
  enableSchemaValidation?: boolean;
  executionHistory?: ExecutionHistory;
  graphObjectStore?: GraphObjectStore;
}

interface ExecuteWithContextOptions {
  graphObjectStore?: GraphObjectStore;
}

const THIRTY_SECONDS_STORAGE_INTERVAL_MS = 60000 / 2;

/**
 * Starts execution of an integration instance generated from local environment
 * variables.
 */
export function executeIntegrationLocally(
  config: IntegrationInvocationConfig,
  options?: ExecuteIntegrationOptions,
) {
  return executeIntegrationInstance(
    createIntegrationLogger({
      name: 'Local',
      invocationConfig: config,
      pretty: true,
    }),
    createIntegrationInstanceForLocalExecution(config),
    config,
    {
      enableSchemaValidation:
        options?.enableSchemaValidation !== undefined
          ? options.enableSchemaValidation
          : true,
    },
  );
}

/**
 * Starts execution of an integration instance.
 */
export async function executeIntegrationInstance(
  logger: IntegrationLogger,
  instance: IntegrationInstance,
  config: IntegrationInvocationConfig,
  options: ExecuteIntegrationOptions = {},
): Promise<ExecuteIntegrationResult> {
  if (options.enableSchemaValidation === true) {
    process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION = 'true';
  }

  return timeOperation({
    logger,
    metricName: 'duration-collect',
    operation: () =>
      executeWithContext(
        {
          instance,
          logger,
          history: options.executionHistory,
        },
        config,
        {
          graphObjectStore: options.graphObjectStore,
        },
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
  TStepExecutionContext extends StepExecutionContext
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
  TStepExecutionContext extends StepExecutionContext
>(
  context: TExecutionContext,
  config: InvocationConfig<TExecutionContext, TStepExecutionContext>,
  options: ExecuteWithContextOptions = {},
): Promise<ExecuteIntegrationResult> {
  await tryPublishDiskUsageMetric(context);

  let diskUsagePublishInterval: NodeJS.Timeout | undefined;
  let executionComplete = false;

  try {
    await removeStorageDirectory();
    const { logger } = context;

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

    const { graphObjectStore = new FileSystemGraphObjectStore() } = options;

    const integrationStepResults = await executeSteps({
      executionContext: context,
      integrationSteps: config.integrationSteps,
      stepStartStates,
      duplicateKeyTracker: new DuplicateKeyTracker(
        config.normalizeGraphObjectKey,
      ),
      graphObjectStore,
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

    return summary;
  } finally {
    executionComplete = true;

    if (diskUsagePublishInterval) {
      clearInterval(diskUsagePublishInterval);
    }

    await tryPublishDiskUsageMetric(context);
  }
}
