import Logger from 'bunyan';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

import {
  DisabledStepReason,
  ExecutionContext,
  IntegrationError,
  IntegrationEvent,
  IntegrationExecutionConfig,
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInstanceConfigFieldMap,
  IntegrationInvocationConfig,
  IntegrationLogger as IntegrationLoggerType,
  IntegrationStepExecutionContext,
  InvocationConfig,
  isProviderAuthError,
  Metric,
  PublishErrorEventInput,
  PublishEventInput,
  PublishEventLevel,
  PublishInfoEventInput,
  PublishWarnEventInput,
  shouldReportErrorToOperator,
  StepExecutionContext,
  StepMetadata,
  SynchronizationJob,
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
} from '@jupiterone/integration-sdk-core';

export * from './registerEventHandlers';

export const PROVIDER_AUTH_ERROR_HELP =
  ' Failed to access provider resource.' +
  ' This integration is likely mis-configured or has insufficient permissions required to access the resource.' +
  " Please ensure your integration's configuration settings are set up correctly.";

// eslint-disable-next-line
const bunyanFormat = require('bunyan-format');

interface CreateLoggerInput<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
> {
  name: string;
  invocationConfig?: InvocationConfig<TExecutionContext, TStepExecutionContext>;
  pretty?: boolean;
  serializers?: Logger.Serializers;
  onFailure?: OnFailureFunction;
}

interface CreateIntegrationLoggerInput<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> extends CreateLoggerInput<
    IntegrationExecutionContext<TInstanceConfig, TExecutionConfig>,
    IntegrationStepExecutionContext<TInstanceConfig, TExecutionConfig>
  > {
  invocationConfig?: IntegrationInvocationConfig<
    TInstanceConfig,
    TExecutionConfig
  >;
}

interface PublishMetricOptions {
  /**
   * Whether the metric data should be logged or not.
   *
   * Default: `true`
   */
  logMetric?: boolean;
}

export function createLogger<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
>({
  name,
  pretty,
  serializers,
  onFailure,
}: CreateLoggerInput<
  TExecutionContext,
  TStepExecutionContext
>): IntegrationLogger {
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

  if (serializers) {
    logger.addSerializers(serializers);
  }

  const errorSet = new Set<Error>();

  return new IntegrationLogger({
    logger,
    errorSet,
    onFailure,
  });
}

/**
 * Create a logger for the integration that will include invocation details and
 * serializers common to all integrations.
 */
export function createIntegrationLogger<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
>({
  name,
  invocationConfig,
  pretty,
  serializers,
  onFailure,
}: CreateIntegrationLoggerInput<
  TInstanceConfig,
  TExecutionConfig
>): IntegrationLogger {
  const serializeInstanceConfig = createInstanceConfigSerializer(
    invocationConfig?.instanceConfigFields,
  );

  return createLogger({
    name,
    pretty,
    serializers: {
      integrationInstanceConfig: serializeInstanceConfig,
      // since config is serializable from
      instance: (instance: IntegrationInstance) => ({
        ...instance,
        config: instance.config
          ? serializeInstanceConfig(instance.config)
          : undefined,
      }),
      ...serializers,
    },
    onFailure,
  });
}

function createInstanceConfigSerializer<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInvocationConfig,
>(fields?: IntegrationInstanceConfigFieldMap<TInstanceConfig>) {
  return (config: any) => {
    if (!config) {
      return config;
    } else {
      const serialized: any = {};
      for (const k of Object.keys(config)) {
        const field = fields && fields[k];
        if (field) {
          serialized[k] = field.mask ? '***' : config[k];
        } else {
          serialized[k] = '***';
        }
      }
      return serialized;
    }
  };
}

interface EventLookup {
  event: IntegrationEvent;
  metric: Metric;
}

interface OnFailureOptions {
  err: Error;
}

type OnFailureFunction = (options: OnFailureOptions) => void;

interface IntegrationLoggerInput {
  logger: Logger;
  errorSet: Set<Error>;
  onFailure?: OnFailureFunction;
}

export class IntegrationLogger
  extends EventEmitter
  implements IntegrationLoggerType
{
  private readonly _logger: Logger;
  private readonly _errorSet: Set<Error>;
  readonly onFailure: OnFailureFunction;

  constructor(input: IntegrationLoggerInput) {
    super();
    this._logger = input.logger;
    this._errorSet = input.errorSet;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.onFailure = input.onFailure || (() => {});
  }

  /**
   * Answers `true` when err has been reported to the logger instance
   * through these functions:
   *
   * * warn(err, ...)
   * * error(err, ...)
   *
   * This can be used by outer `try/catch` blocks to avoid logging the same
   * error twice:
   *
   * ```js
   * if (!logger.isHandledError(err)) {
   *   logger.error(err);
   * }
   * ```
   *
   * @param err a caught Error
   */
  isHandledError(err: Error) {
    return this._errorSet.has(err);
  }

  debug(...params: any[]) {
    return this._logger.debug(...params);
  }
  info(...params: any[]) {
    return this._logger.info(...params);
  }

  warn(...params: any[]) {
    this.trackHandledError(params[0]);

    this.publishMetric(
      {
        name: 'logged_warn',
        value: 1,
      },
      {
        logMetric: false,
      },
    );

    return this._logger.warn(...params);
  }

  fatal(...params: any[]) {
    return this._logger.fatal(...params);
  }

  trace(...params: any[]) {
    if (params.length === 0) {
      return;
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

    return this._logger.trace(
      { verbose: true, ...additionalFields },
      ...remainingArgs,
    );
  }

  error(...params: any[]) {
    this.trackHandledError(params[0]);

    this.publishMetric(
      {
        name: 'logged_error',
        value: 1,
      },
      {
        logMetric: false,
      },
    );

    this._logger.error(...params);
  }

  child(options: object = {}, simple?: boolean) {
    const childLogger = new IntegrationLogger({
      errorSet: this._errorSet,
      logger: this._logger.child(options, simple),
      onFailure: this.onFailure,
    });

    // pass events to parent
    childLogger.on('event', (data) => this.emit('event', data));
    childLogger.on('metric', (data) => this.emit('metric', data));

    return childLogger;
  }

  emit<T extends EventLookup, K extends keyof EventLookup>(
    name: K,
    data: T[K],
  ) {
    return super.emit(name, data);
  }

  stepStart(step: StepMetadata) {
    const name = 'step_start';
    const description = `Starting step "${step.name}"...`;
    this.info(description);
    this.publishEvent({ name, description });
  }

  stepSuccess(step: StepMetadata) {
    const name = 'step_end';
    const description = `Completed step "${step.name}".`;
    this.info(description);
    this.publishEvent({ name, description });
  }

  stepSkip(step: StepMetadata, reason: DisabledStepReason) {
    if (!reason || reason === DisabledStepReason.NONE) {
      return;
    }

    const name = 'step_skip';
    let description = `Skipped step "${step.name}". `;

    switch (reason) {
      case DisabledStepReason.BETA: {
        description += `Beta feature, please contact support to enable.`;
        break;
      }
      case DisabledStepReason.PERMISSION: {
        description += `The required permission was not provided to perform this step.`;
        break;
      }
      case DisabledStepReason.CONFIG: {
        description += `This step is disabled via configuration. Please contact support to enabled.`;
      }
    }

    this.info(description);
    this.publishEvent({ name, description });
  }

  stepFailure(step: StepMetadata, err: Error) {
    const eventName = 'step_failure';
    const { errorId, description } = createErrorEventDescription(
      err,
      `Step "${step.name}" failed to complete due to error.`,
    );
    this.handleFailure({ eventName, errorId, err, description });
  }

  synchronizationUploadStart(job: SynchronizationJob) {
    const name = 'sync_upload_start';
    const description = 'Uploading collected data for synchronization...';
    this.info(
      {
        synchronizationJobId: job.id,
      },
      description,
    );
    this.publishEvent({ name, description });
  }

  synchronizationUploadEnd(job: SynchronizationJob) {
    const name = 'sync_upload_end';
    const description = 'Upload complete.';
    this.info(
      {
        synchronizationJobId: job.id,
      },
      description,
    );
    this.publishEvent({ name, description });
  }

  validationFailure(err: Error) {
    const eventName = 'validation_failure';
    const { errorId, description } = createErrorEventDescription(
      err,
      `Error occurred while validating integration configuration.`,
    );
    this.handleFailure({ eventName, errorId, err, description });
  }

  private handleFailure(options: {
    eventName: 'validation_failure' | 'step_failure';
    errorId: string;
    err: Error;
    description: string;
  }) {
    const { eventName, errorId, err, description } = options;

    // If there is a `code` property on the `Error`, we should include this
    // in our log. This is helpful for when we receive an HTTP response error
    // and the service includes specific codes (e.g. the JupiterOne system).
    const code = (err as any).code;

    if (shouldReportErrorToOperator(err)) {
      this.error({ errorId, err, code }, description);
      this.onFailure({ err });
    } else {
      this.warn({ errorId, err, code }, description);
    }

    this.publishEvent({
      name: eventName,
      description,
      level: PublishEventLevel.Error,
    });
  }

  publishMetric(
    metric: Omit<Metric, 'timestamp'>,
    { logMetric = true }: PublishMetricOptions = {},
  ) {
    const metricWithTimestamp = {
      ...metric,
      timestamp: Date.now(),
    };

    if (logMetric) {
      this.info({ metric: metricWithTimestamp }, 'Collected metric.');
    }

    // emit the metric so that consumers can collect the metric
    // and publish it if needed
    return this.emit('metric', metricWithTimestamp);
  }

  publishEvent(event: PublishEventInput) {
    return this.emit('event', {
      ...event,
      level: event.level || PublishEventLevel.Info,
    });
  }

  publishInfoEvent(event: PublishInfoEventInput) {
    return this.publishEvent({ ...event, level: PublishEventLevel.Info });
  }

  publishWarnEvent(event: PublishWarnEventInput) {
    return this.publishEvent({ ...event, level: PublishEventLevel.Warn });
  }

  publishErrorEvent(event: PublishErrorEventInput) {
    return this.publishEvent({ ...event, level: PublishEventLevel.Error });
  }

  private trackHandledError(logArg: any): void {
    if (logArg instanceof Error) {
      this._errorSet.add(logArg);
    } else if (logArg?.err instanceof Error) {
      this._errorSet.add(logArg.err);
    }
  }
}

type NameValuePair = [string, any];

export function createErrorEventDescription(
  err: Error | IntegrationError,
  message: string,

  /**
   * Optional data that will be added as name/value pairs to the
   * event description.
   */
  eventData?: object,
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

  if (isProviderAuthError(err)) {
    // add additional instructions to the displayed message
    // if we know that this is an auth error
    message += PROVIDER_AUTH_ERROR_HELP;
  }

  const nameValuePairs: NameValuePair[] = [
    ['errorCode', errorCode],
    ['errorId', errorId],
    ['reason', errorReason],
  ];

  if (eventData) {
    for (const key of Object.keys(eventData)) {
      nameValuePairs.push([key, eventData[key]]);
    }
  }

  const errorDetails = nameValuePairs
    .map((nameValuePair) => {
      return `${nameValuePair[0]}=${JSON.stringify(nameValuePair[1])}`;
    })
    .join(', ');

  return {
    errorId,
    description: `${message} (${errorDetails})`,
  };
}
