import { v4 as uuid } from 'uuid';
import Logger from 'bunyan';
import PromiseQueue from 'p-queue';

import {
  IntegrationLogger,
  IntegrationStep,
  IntegrationInstance,
  IntegrationInvocationConfig,
  IntegrationInstanceConfigFieldMap,
} from './types';

import { SynchronizationJobContext } from '../synchronization';
import {
  IntegrationError,
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
} from '../../errors';

// eslint-disable-next-line
const bunyanFormat = require('bunyan-format');

interface CreateIntegrationLoggerInput {
  name: string;
  invocationConfig?: IntegrationInvocationConfig;
  pretty?: boolean;
  serializers?: Logger.Serializers;
}

/**
 * Create a logger for the integration that will include invocation details and
 * serializers common to all integrations.
 */
export function createIntegrationLogger({
  name,
  invocationConfig,
  pretty,
  serializers,
}: CreateIntegrationLoggerInput): IntegrationLogger {
  const loggerConfig: Logger.LoggerOptions = {
    name,
    level: (process.env.LOG_LEVEL || 'info') as Logger.LogLevel,
    serializers: {
      err: Logger.stdSerializers.err,
    },
  };

  if (pretty) {
    loggerConfig.streams = [{ stream: bunyanFormat({ outputMode: 'short' }) }];
  }

  const logger = Logger.createLogger(loggerConfig);

  const serializeInstanceConfig = createInstanceConfigSerializer(
    invocationConfig?.instanceConfigFields,
  );

  logger.addSerializers({
    integrationInstanceConfig: serializeInstanceConfig,
    // since config is serializable from
    instance: (instance: IntegrationInstance) => ({
      ...instance,
      config: instance.config
        ? serializeInstanceConfig(instance.config)
        : undefined,
    }),
  });

  if (serializers) {
    logger.addSerializers(serializers);
  }

  // NOTE: concurrency is set to one to allow for logs to be published in
  // the order that they are added to the queue.
  //
  // Optimizations can come later once the synchronization api supports
  // accepting a timestamp.
  const eventPublishingQueue = new PromiseQueue({ concurrency: 1 });

  return instrumentEventLogging(
    instrumentVerboseTrace(logger),
    eventPublishingQueue,
  );
}

function createInstanceConfigSerializer(
  fields?: IntegrationInstanceConfigFieldMap,
) {
  return (config: any) => {
    if (!config) {
      return config;
    } else {
      const serialized: any = {};
      for (const k of Object.keys(config)) {
        const field = fields && fields[k];
        if (field) {
          serialized[k] = field.mask
            ? `****${config[k].substr(-4)}`
            : config[k];
        } else {
          serialized[k] = '***';
        }
      }
      return serialized;
    }
  };
}

function instrumentVerboseTrace(logger: Logger): Logger {
  const trace = logger.trace;
  const child = logger.child;

  Object.assign(logger, {
    trace: (...params: any[]) => {
      if (params.length === 0) {
        return trace.apply(logger);
      }

      let additionalFields: Record<string, any> = {};
      let remainingArgs: any[] = params;
      if (params[0] instanceof Error) {
        additionalFields = { err: params[0] };
        remainingArgs = params.slice(1);
      } else if (typeof params[0] === 'object') {
        additionalFields = params[0];
        remainingArgs = params.slice(1);
      }

      trace.apply(logger, [
        { verbose: true, ...additionalFields },
        ...remainingArgs,
      ]);
    },

    child: (options: object = {}, simple?: boolean) => {
      const c = child.apply(logger, [options, simple]);
      return instrumentVerboseTrace(c);
    },
  });

  return logger;
}

function instrumentEventLogging(
  logger: Logger,
  eventPublishingQueue: PromiseQueue,
  inputSynchronizationJobContext?: SynchronizationJobContext,
): IntegrationLogger {
  const child = logger.child;

  let synchronizationJobContext:
    | SynchronizationJobContext
    | undefined = inputSynchronizationJobContext;

  const publishEvent = (name: string, description: string) => {
    if (synchronizationJobContext) {
      const { job, apiClient } = synchronizationJobContext;

      const event = { name, description };

      eventPublishingQueue.add(async () => {
        try {
          await apiClient.post(
            `/persister/synchronization/jobs/${job.id}/events`,
            {
              events: [event],
            },
          );
        } catch (err) {
          // It's not the end of the world if we fail to publish
          // an event
          logger.error(
            {
              err,
              event,
            },
            'Failed to publish integration event.',
          );
        }
      });
    }
  };

  return Object.assign(logger, {
    flush: async () => {
      await eventPublishingQueue.onIdle();
    },

    registerSynchronizationJobContext: (context: SynchronizationJobContext) => {
      synchronizationJobContext = context;
    },

    stepStart: (step: IntegrationStep) => {
      const name = 'step-start';
      const description = `Starting step "${step.name}"...`;
      logger.info({ step: step.id }, description);

      publishEvent(name, description);
    },
    stepSuccess: (step: IntegrationStep) => {
      const name = 'step-end';
      const description = `Completed step "${step.name}".`;
      logger.info({ step: step.id }, description);

      publishEvent(name, description);
    },
    stepFailure: (step: IntegrationStep, err: Error) => {
      const name = 'step-failure';
      const { errorId, description } = createErrorEventDescription(
        err,
        `Step "${step.name}" failed to complete due to error.`,
      );

      logger.error({ errorId, err, step: step.id }, description);

      publishEvent(name, description);
    },
    validationFailure: (err: Error) => {
      const name = 'validation-failure';
      const { errorId, description } = createErrorEventDescription(
        err,
        `Error occurred while validating integration configuration.`,
      );

      logger.error({ errorId, err }, description);
      publishEvent(name, description);
    },
    child: (options: object = {}, simple?: boolean) => {
      const c = child.apply(logger, [options, simple]);
      return instrumentEventLogging(
        c,
        eventPublishingQueue,
        synchronizationJobContext,
      );
    },
  });
}

export function createErrorEventDescription(
  err: Error | IntegrationError,
  message: string,
) {
  const errorId = uuid();

  let errorCode: string;
  let errorReason: string;

  if (err instanceof IntegrationError) {
    errorCode = err.code;
    errorReason = err.message;
  } else {
    errorCode = UNEXPECTED_ERROR_CODE;
    errorReason = UNEXPECTED_ERROR_REASON;
  }

  const errorDetails = `errorCode=${errorCode}, errorId=${errorId}, reason=${errorReason}`;

  return {
    errorId,
    description: `${message} (${errorDetails})`,
  };
}
