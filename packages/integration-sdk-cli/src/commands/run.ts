import { Command, createCommand, OptionValues } from 'commander';
import path from 'path';

import { Metric } from '@jupiterone/integration-sdk-core';
import {
  abortSynchronization,
  createApiClient,
  createEventPublishingQueue,
  createIntegrationInstanceForLocalExecution,
  createIntegrationLogger,
  executeIntegrationInstance,
  FileSystemGraphObjectStore,
  finalizeSynchronization,
  initiateSynchronization,
  synchronizationStatus,
} from '@jupiterone/integration-sdk-runtime';
import { createPersisterApiStepGraphObjectDataUploader } from '@jupiterone/integration-sdk-runtime/dist/src/execution/uploader';

import { loadConfig } from '../config';
import {
  addApiClientOptionsToCommand,
  addLoggingOptions,
  addPathOptionsToCommand,
  addSyncOptionsToCommand,
  configureRuntimeFilesystem,
  getApiClientOptions,
  getSyncOptions,
  validateApiClientOptions,
  validateSyncOptions,
} from './options';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
} from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';

const DEFAULT_UPLOAD_CONCURRENCY = 5;

export function run(): Command {
  const command = createCommand('run');

  addPathOptionsToCommand(command);
  addApiClientOptionsToCommand(command);
  addSyncOptionsToCommand(command);
  addLoggingOptions(command);

  return command
    .description('collect and sync to upload entities and relationships')
    .option('-V, --disable-schema-validation', 'disable schema validation')
    .action(async (options: OptionValues, actionCommand: Command) => {
      configureRuntimeFilesystem(actionCommand.opts());
      validateApiClientOptions(actionCommand.opts());
      validateSyncOptions(actionCommand.opts());

      const startTime = Date.now();

      const clientApiOptions = getApiClientOptions(actionCommand.opts());
      const apiClient = createApiClient(clientApiOptions);

      let logger = createIntegrationLogger({
        name: 'local',
        pretty: !options.noPretty,
      });

      logger.info(
        {
          apiBaseUrl: clientApiOptions.apiBaseUrl,
        },
        `Configured JupiterOne API Client`,
      );

      const synchronizationContext = await initiateSynchronization({
        logger,
        apiClient,
        ...getSyncOptions(actionCommand.opts()),
      });

      logger = synchronizationContext.logger;

      const eventPublishingQueue = createEventPublishingQueue(
        synchronizationContext,
      );
      const metrics: Metric[] = [];

      logger
        .on('event', (event) => eventPublishingQueue.enqueue(event))
        .on('metric', (metric) => metrics.push(metric));

      const invocationConfig = await loadConfig(
        path.resolve(options.projectPath, 'src'),
      );

      const graphObjectStore = new FileSystemGraphObjectStore({
        prettifyFiles: !options.noPretty,
        integrationSteps: invocationConfig.integrationSteps,
      });

      try {
        const enableSchemaValidation = !options.disableSchemaValidation;
        const resource = Resource.default().merge(
          new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: 'integration-sdk-run',
            [SemanticResourceAttributes.SERVICE_VERSION]: '0.1.0',
          }),
        );
        const tracerProvider = new NodeTracerProvider({
          resource,
        });
        const exporter = new OTLPTraceExporter({
          url:
            'http://' +
            (process.env.OTEL_COLLECTOR_URL ?? 'localhost:4318') +
            '/v1/traces',
        });
        const processor = new BatchSpanProcessor(exporter);
        tracerProvider.addSpanProcessor(processor);
        tracerProvider.register();

        const tracer = tracerProvider.getTracer('tracer');

        const executionResults = await executeIntegrationInstance(
          logger,
          createIntegrationInstanceForLocalExecution(invocationConfig),
          invocationConfig,
          {
            current: {
              startedOn: synchronizationContext.job.startTimestamp,
            },
          },
          {
            tracer,
            enableSchemaValidation,
            graphObjectStore,
            createStepGraphObjectDataUploader(stepId) {
              return createPersisterApiStepGraphObjectDataUploader({
                stepId,
                synchronizationJobContext: synchronizationContext,
                uploadConcurrency: DEFAULT_UPLOAD_CONCURRENCY,
              });
            },
          },
        );

        await eventPublishingQueue.onIdle();

        if (options.skipFinalize) {
          logger.info(
            'Skipping synchronization finalization. Job will remain in "AWAITING_UPLOADS" state.',
          );
          const synchronizationJob = await synchronizationStatus(
            synchronizationContext,
          );
          logger.info({ synchronizationJob }, 'Synchronization job status.');
        } else {
          const synchronizationJob = await finalizeSynchronization({
            ...synchronizationContext,
            partialDatasets: executionResults.metadata.partialDatasets,
          });
          logger.info(
            { synchronizationJob },
            'Synchronization finalization result.',
          );
        }
        await tracerProvider.forceFlush();
        await tracerProvider.shutdown();
        await processor.forceFlush();
        await exporter.forceFlush();

        await exporter.shutdown();
      } catch (err) {
        await eventPublishingQueue.onIdle();
        if (!logger.isHandledError(err)) {
          logger.error(
            err,
            'Unexpected error occurred during integration run.',
          );
        }

        const abortResult = await abortSynchronization({
          ...synchronizationContext,
          reason: err.message,
        });
        logger.error({ abortResult }, 'Synchronization job abort result.');
      } finally {
        logger.publishMetric({
          name: 'duration-total',
          value: Date.now() - startTime,
          unit: 'Milliseconds',
        });
      }
    });
}
