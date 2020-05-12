import { IntegrationStep } from './step';
import {
  SynchronizationJobContext,
  SynchronizationJob,
} from '../../synchronization';

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction {
  (options: object): IntegrationLogger;
}

type StepLogFunction = (step: IntegrationStep) => void;
type StepLogFunctionWithError = (step: IntegrationStep, err: Error) => void;
type SynchronizationLogFunction = (job: SynchronizationJob) => void;
type ValidationLogFunction = (err: Error) => void;
type IsHandledErrorFunction = (err: Error) => boolean;

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

export type LoggerSynchronizationJobContext = Pick<
  SynchronizationJobContext,
  'apiClient' | 'job'
>;

export interface IntegrationLogger extends BaseLogger {
  registerSynchronizationJobContext: (
    context: LoggerSynchronizationJobContext,
  ) => IntegrationLogger;

  isHandledError: IsHandledErrorFunction;

  // Special log functions used to publish events to j1
  stepStart: StepLogFunction;
  stepSuccess: StepLogFunction;
  stepFailure: StepLogFunctionWithError;
  synchronizationUploadStart: SynchronizationLogFunction;
  synchronizationUploadEnd: SynchronizationLogFunction;
  validationFailure: ValidationLogFunction;

  // flushes the queue of work to ensure that
  // all events have been published
  flush: () => Promise<void>;
}
