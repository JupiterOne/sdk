import { DisabledStepReason, StepMetadata } from './';
import { SynchronizationJob } from './synchronization';
import { Metric } from './metric';

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction {
  (options: object): IntegrationLogger;
}

type StepLogFunction = (step: StepMetadata) => void;
type StepLogFunctionWithReason = (
  step: StepMetadata,
  reason: DisabledStepReason,
) => void;
type StepLogFunctionWithError = (step: StepMetadata, err: Error) => void;
type SynchronizationLogFunction = (job: SynchronizationJob) => void;
type ValidationLogFunction = (err: Error) => void;
type IsHandledErrorFunction = (err: Error) => boolean;

export enum PublishEventLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export type IntegrationEvent = {
  name: string;
  description: string;
  level: PublishEventLevel;
};

export type PublishEventInput = {
  name: string;
  description: string;
  level?: PublishEventLevel;
};

export enum IntegrationInfoEventName {
  Stats = 'stats',
  Results = 'results',
}

export interface PublishInfoEventInput extends PublishEventInput {
  name: IntegrationInfoEventName;
}

export enum IntegrationWarnEventName {
  MissingPermission = 'warn_missing_permission',
  /**
   * Some J1 integrations are configured to only ingest up to a set number
   * of entities in a given integration job.
   * We would like to indicate to the end-user when this limit is encountered
   */
  IngestionLimitEncountered = 'warn_ingestion_limit_encountered',
  MissingEntity = 'warn_missing_entity',
}

export interface PublishWarnEventInput extends PublishEventInput {
  name: IntegrationWarnEventName;
}

/**
 * NOTE: using event names which include the substring 'error' will
 * cause the integration to be marked with 'status: FAILED'
 */
export enum IntegrationErrorEventName {
  MissingPermission = 'error_missing_permission',
  /**
   * Some J1 integrations are configured to only ingest up to a set number
   * of entities in a given integration job.
   * Additionally, some integrations rely on the last successful execution to determine what issues to ingest.
   * We would like to indicate to the end-user when this limit is encountered, and then fail the execution on completion.
   */
  IngestionLimitEncountered = 'error_ingestion_limit_encountered',
  /**
   * In some rare cases, the mapped properties of an entity can be so large that they trigger upload errors due to payload size.
   * This points to a possible poison pill in the api the integration is consuming. We would like to indicate to the end-user when this
   * error is encountered.
   */
  EntitySizeLimitEncountered = 'error_entity_size_limit_encountered',
}

export interface PublishErrorEventInput extends PublishEventInput {
  name: IntegrationErrorEventName;
}

type PublishMetricFunction = (metric: Omit<Metric, 'timestamp'>) => void;

interface BaseLogger {
  // traditional functions for regular logging
  trace: LogFunction;
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  fatal: LogFunction;
  child: ChildLogFunction;
}

export interface IntegrationLoggerFunctions {
  /**
   * Answers true when an error has already been handled by this logger instance
   * (in `warn` or `error`).
   *
   * There are some errors which are handled in the context where they occur.
   * Once they have been logged, they may be re-thrown to break out of that
   * context, but they should not be logged again. This mechanism allows higher
   * catch blocks to discover whether the logger has already handled an error
   * and if so, to avoid double logging.
   */
  isHandledError: IsHandledErrorFunction;

  // Special log functions used to publish events to j1

  stepStart: StepLogFunction;
  stepSuccess: StepLogFunction;
  stepFailure: StepLogFunctionWithError;
  stepSkip: StepLogFunctionWithReason;
  synchronizationUploadStart: SynchronizationLogFunction;
  synchronizationUploadEnd: SynchronizationLogFunction;

  /**
   * Handles logging of errors that are raised in `validateInvocation`.
   *
   * `IntegrationValidationError` and `IntegrationProviderAuthenticationError`
   * are logged at `level: 40`, expecting these to be user errors that should
   * not alert in runtime environments. Other error types will be logged at
   * `level: 50`.
   */
  validationFailure: ValidationLogFunction;

  publishMetric: PublishMetricFunction;

  /**
   * @deprecated
   * Please defer to using `publishInfoEvent`, `publishWarnEvent`, and `publishErrorEvent`
   */
  publishEvent: (options: PublishEventInput) => void;

  /**
   * Publish a job log event at level 'info'
   */
  publishInfoEvent: (event: PublishInfoEventInput) => void;

  /**
   * Publish a job log event at level 'warn'
   */
  publishWarnEvent: (event: PublishWarnEventInput) => void;

  /**
   * Publish a job log event at level 'error'
   */
  publishErrorEvent: (event: PublishErrorEventInput) => void;
}

export type IntegrationLogger = BaseLogger & IntegrationLoggerFunctions;
