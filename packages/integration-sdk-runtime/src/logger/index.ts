import Logger from 'bunyan';
import { inspect } from 'util';
import { EventEmitter } from 'events';
import { randomUUID as uuid } from 'crypto';

import {
  ExecutionContext,
  IntegrationError,
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInstanceConfigFieldMap,
  IntegrationInvocationConfig,
  IntegrationLogger as IntegrationLoggerType,
  IntegrationStepExecutionContext,
  InvocationConfig,
  isProviderAuthError,
  Metric,
  shouldReportErrorToOperator,
  StepExecutionContext,
  StepMetadata,
  SynchronizationJob,
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
  IntegrationInstanceConfig,
  PublishEventInput,
  PublishWarnEventInput,
  PublishEventLevel,
  IntegrationEvent,
  PublishInfoEventInput,
  PublishErrorEventInput,
  DisabledStepReason,
  PublishMetricOptions,
  StepLogAdditionalContext,
} from '@jupiterone/integration-sdk-core';

export * from './registerEventHandlers';

export const PROVIDER_AUTH_ERROR_HELP =
  ' Failed to access provider resource.' +
  ' This integration is likely misconfigured or has insufficient permissions required to access the resource.' +
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
  TIntegrationConfig extends
    IntegrationInstanceConfig = IntegrationInstanceConfig,
> extends CreateLoggerInput<
    IntegrationExecutionContext<TIntegrationConfig>,
    IntegrationStepExecutionContext<TIntegrationConfig>
  > {
  invocationConfig?: IntegrationInvocationConfig<TIntegrationConfig>;
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
      err: function (err) {
        if (!err || !err.stack) return err;
        return {
          message: err.message,
          name: err.name,
          stack: inspect(err, false, 10),
          code: err.code,
          signal: err.signal,
        };
      },
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
  TIntegrationConfig extends
    IntegrationInstanceConfig = IntegrationInstanceConfig,
>({
  name,
  invocationConfig,
  pretty,
  serializers,
  onFailure,
}: CreateIntegrationLoggerInput<TIntegrationConfig>): IntegrationLogger {
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
  TConfig extends IntegrationInstanceConfig = IntegrationInvocationConfig,
>(fields?: IntegrationInstanceConfigFieldMap<TConfig>) {
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
  private _logger: Logger;
  private _errorSet: Set<Error>;
  readonly onFailure: OnFailureFunction;

  constructor(input: IntegrationLoggerInput) {
    super();
    this._logger = input.logger;
    this._errorSet = input.errorSet;

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.onFailure = input.onFailure || (() => {});
  }

  /**
   * Answers `true` when the err has been reported to the logger instance
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
    this.debug(description);
    this.publishEvent({ name, description });
  }

  stepSuccess(step: StepMetadata) {
    const name = 'step_end';
    const description = `Completed step "${step.name}".`;
    this.debug(description);
    this.publishEvent({ name, description });
  }

  stepSkip(
    step: StepMetadata,
    reason: DisabledStepReason,
    additionalContext?: StepLogAdditionalContext,
  ) {
    if (!reason || reason === DisabledStepReason.NONE) {
      return;
    }

    const name = 'step_skip';
    let description = `Skipped step "${step.name}". `;

    switch (reason) {
      case DisabledStepReason.API_VERSION: {
        description += `This step is disabled due to a limitation in the third party API version that is being used.  Please review documentation for this integration for further information.`;
        break;
      }
      case DisabledStepReason.BETA: {
        description += `Beta feature, please contact support to enable.`;
        break;
      }
      case DisabledStepReason.PERMISSION: {
        description += `The required permission was not provided to perform this step.`;
        break;
      }
      case DisabledStepReason.CONFIG: {
        description += `Step was disabled via configuration. Please contact support to enable.`;
        break;
      }
      case DisabledStepReason.USER_CONFIG: {
        description += `Step was disabled via configuration. Update instance config to enable.`;
        break;
      }
      case DisabledStepReason.PARENT_DISABLED: {
        const parentStepName = additionalContext?.parentStep?.name;
        if (!parentStepName) {
          this.warn(`Parent step not provided for child step ${step.name}`);
        }
        description += parentStepName
          ? `Step was disabled because parent step "${parentStepName}" was disabled. In order to enable this step, please check logs for more information about the parent step.`
          : 'Step was disabled because parent step was disabled. In order to enable this step, please check logs for more information about the parent step.';
        break;
      }
    }

    this.info(description);
    this.publishEvent({ name, description });
  }

  stepFailure(step: StepMetadata, err: Error) {
    const eventName = 'step_failure';
    this._logger.info(
      { errconstructorname: err.constructor?.name },
      'Error Constructorname',
    );
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
    this._logger.info(
      { errconstructorname: err.constructor?.name },
      'Error Constructorname',
    );
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
      this.debug({ metric: metricWithTimestamp }, 'Collected metric.');
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

const NAMED_INTEGRATION_ERROR_CLASSES = new Set([
  'UnaccountedStepStartStatesError',
  'StepStartStateUnknownStepIdsError',
  'UploadError',
]);

function isIntegrationErrorClassName(name: unknown): boolean {
  return (
    typeof name === 'string' &&
    (name.startsWith('Integration') ||
      NAMED_INTEGRATION_ERROR_CLASSES.has(name))
  );
}

/**
 * Checks if an error is an IntegrationError or one of its subclasses.
 * This function is more reliable than instanceof when dealing with multiple
 * module instances that might have different IntegrationError class references.
 *
 * The whole prototype chain is checked, so integration-defined subclasses such
 * as `class RateLimitError extends IntegrationProviderAPIError` are recognized
 * and show their own code and message instead of `UNEXPECTED_ERROR`.
 */
function isIntegrationError(err: any): err is IntegrationError {
  if (
    !err ||
    typeof err !== 'object' ||
    typeof err.code !== 'string' ||
    !('fatal' in err)
  ) {
    return false;
  }

  if (err instanceof IntegrationError) {
    return true;
  }

  for (
    let proto = Object.getPrototypeOf(err);
    proto && proto !== Error.prototype && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    if (isIntegrationErrorClassName(proto.constructor?.name)) {
      return true;
    }
  }

  return false;
}

export const REQUEST_TIMEOUT_ERROR_CODE = 'REQUEST_TIMEOUT_ERROR';
export const REQUEST_TIMEOUT_ERROR_REASON =
  'A request made by the integration timed out before the service responded. This is usually temporary and the next run will try again. If it keeps happening, please contact us at support@jupiterone.com.';

export const NETWORK_CONNECTION_ERROR_CODE = 'NETWORK_CONNECTION_ERROR';
export const NETWORK_CONNECTION_ERROR_REASON =
  'A network connection made by the integration failed or was cut off. This is usually temporary and the next run will try again. If it keeps happening, check that the service is reachable from JupiterOne, or contact us at support@jupiterone.com.';

export const HOST_NOT_FOUND_ERROR_CODE = 'HOST_NOT_FOUND_ERROR';
export const HOST_NOT_FOUND_ERROR_REASON =
  'The integration could not find the host name of a service it calls. Check that the host name or URL in the integration configuration is correct.';

export const INVALID_RESPONSE_FORMAT_ERROR_CODE =
  'INVALID_RESPONSE_FORMAT_ERROR';
export const INVALID_RESPONSE_FORMAT_ERROR_REASON =
  'A service called by the integration returned a web page instead of the expected data. This often means the URL in the integration configuration is wrong, or a proxy, firewall or sign-in page is in the way. It can also happen when the service is down and returns an error page.';

const REQUEST_TIMEOUT_CODES = new Set([
  'ATTEMPT_TIMEOUT', // @lifeomic/attempt `timeout` option
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'TimeoutError', // AWS SDK
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

const NETWORK_CONNECTION_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_SOCKET',
]);

/**
 * Body of an HTML page parsed as JSON, e.g. `Unexpected token < in JSON at
 * position 0` (Node 18) or `Unexpected token '<', "<!DOCTYPE "... is not
 * valid JSON` (Node 20+).
 */
const HTML_PARSED_AS_JSON = /Unexpected token '?<'?/;

const MAX_CAUSE_DEPTH = 3;

/**
 * Maps a well-known, non-`IntegrationError` failure (network timeouts, DNS
 * failures, HTML returned where JSON was expected) to a code and a fixed,
 * customer-safe reason. The error's own message is never used, because it may
 * hold internal addresses or URLs. Returns `undefined` for anything else.
 */
function classifyUnexpectedError(
  err: unknown,
): { code: string; reason: string } | undefined {
  let current: any = err;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth++) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    const code = typeof current.code === 'string' ? current.code : undefined;
    const name = typeof current.name === 'string' ? current.name : undefined;
    const message = typeof current.message === 'string' ? current.message : '';

    if (code === 'ENOTFOUND') {
      return {
        code: HOST_NOT_FOUND_ERROR_CODE,
        reason: HOST_NOT_FOUND_ERROR_REASON,
      };
    }

    if ((code && REQUEST_TIMEOUT_CODES.has(code)) || name === 'TimeoutError') {
      return {
        code: REQUEST_TIMEOUT_ERROR_CODE,
        reason: REQUEST_TIMEOUT_ERROR_REASON,
      };
    }

    if (
      (code && NETWORK_CONNECTION_CODES.has(code)) ||
      // undici (Node `fetch`) network failures
      (name === 'TypeError' &&
        (message === 'fetch failed' || message === 'terminated'))
    ) {
      return {
        code: NETWORK_CONNECTION_ERROR_CODE,
        reason: NETWORK_CONNECTION_ERROR_REASON,
      };
    }

    if (
      (name === 'SyntaxError' ||
        (name === 'FetchError' && current.type === 'invalid-json')) &&
      HTML_PARSED_AS_JSON.test(message)
    ) {
      return {
        code: INVALID_RESPONSE_FORMAT_ERROR_CODE,
        reason: INVALID_RESPONSE_FORMAT_ERROR_REASON,
      };
    }

    current = current.cause;
  }

  return undefined;
}

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

  if (isIntegrationError(err)) {
    errorCode = (err as IntegrationError).code;
    errorReason = err.message;
  } else {
    const classified = classifyUnexpectedError(err);
    errorCode = classified?.code ?? UNEXPECTED_ERROR_CODE;
    errorReason = classified?.reason ?? UNEXPECTED_ERROR_REASON;
  }

  if (isProviderAuthError(err)) {
    // add additional instructions to the displayed message
    // if we know that this is an auth error
    message += PROVIDER_AUTH_ERROR_HELP;
  }

  const nameValuePairs: NameValuePair[] = [
    ['errorCode', errorCode],
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
