import { IntegrationStep } from './step';
import { SynchronizationJobContext } from '../../synchronization';

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction {
  (options: object): IntegrationLogger;
}

type StepLogFunction = (step: IntegrationStep) => void;
type StepLogFunctionWithError = (step: IntegrationStep, err: Error) => void;
type ValidationLogFunction = (err: Error) => void;

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

export interface IntegrationLogger extends BaseLogger {
  registerSynchronizationJobContext: (
    context: SynchronizationJobContext,
  ) => void;

  // Special log functions used to publish events to j1
  stepStart: StepLogFunction;
  stepSuccess: StepLogFunction;
  stepFailure: StepLogFunctionWithError;
  validationFailure: ValidationLogFunction;

  // flushes the queue of work to ensure that
  // all events have been published
  flush: () => Promise<void>;
}
