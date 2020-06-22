import { StepMetadata } from './';
import { SynchronizationJob } from './synchronization';
import { Metric } from './metric';

export interface IntegrationEvent {
  name: string;
  description: string;
}

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction {
  (options: object): IntegrationLogger;
}

type StepLogFunction = (step: StepMetadata) => void;
type StepLogFunctionWithError = (step: StepMetadata, err: Error) => void;
type SynchronizationLogFunction = (job: SynchronizationJob) => void;
type ValidationLogFunction = (err: Error) => void;
type IsHandledErrorFunction = (err: Error) => boolean;

type PublishEventInput = {
  name: string;
  description: string;
};

type PublishMetricFunction = (metric: Omit<Metric, 'timestamp'>) => void;

type PublishEventFunction = (options: PublishEventInput) => void;

type PublishErrorEventInput = {
  /**
   * A name to associate with error
   */
  name: string;

  message: string;

  /**
   * The raw error that occurred
   */
  err: Error;

  /**
   * Any additional data that will only be logged (not published with event)
   */
  logData?: object;

  /**
   * Contents of `eventData` will be serialized and added to the description
   * property of the event but it will not be logged.
   */
  eventData?: object;
};

type PublishErrorEventFunction = (options: PublishErrorEventInput) => void;

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
   * Answers true when an error has already by handled by this logger instance
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
   */
  publishEvent: PublishEventFunction;

  /**
   * @deprecated
   */
  publishErrorEvent: PublishErrorEventFunction;
}

export type IntegrationLogger = BaseLogger & IntegrationLoggerFunctions;
