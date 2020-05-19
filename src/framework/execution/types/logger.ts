import { Step, StepExecutionContext } from './';
import {
  SynchronizationJobContext,
  SynchronizationJob,
} from '../../synchronization';

interface LogFunction {
  (...args: any[]): boolean | void;
}

interface ChildLogFunction<TStepExecutionContext extends StepExecutionContext> {
  (options: object): IntegrationLogger<TStepExecutionContext>;
}

type StepLogFunction<TStepExecutionContext extends StepExecutionContext> = (
  step: Step<TStepExecutionContext>,
) => void;
type StepLogFunctionWithError<
  TStepExecutionContext extends StepExecutionContext
> = (step: Step<TStepExecutionContext>, err: Error) => void;
type SynchronizationLogFunction = (job: SynchronizationJob) => void;
type ValidationLogFunction = (err: Error) => void;
type IsHandledErrorFunction = (err: Error) => boolean;

interface BaseLogger<TStepExecutionContext extends StepExecutionContext> {
  // traditional functions for regular logging
  trace: LogFunction;
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
  fatal: LogFunction;
  child: ChildLogFunction<TStepExecutionContext>;
}

export type LoggerSynchronizationJobContext = Pick<
  SynchronizationJobContext,
  'apiClient' | 'job'
>;

export interface IntegrationLogger<
  TStepExecutionContext extends StepExecutionContext
> extends BaseLogger {
  registerSynchronizationJobContext: (
    context: LoggerSynchronizationJobContext,
  ) => IntegrationLogger<TStepExecutionContext>;

  isHandledError: IsHandledErrorFunction;

  // Special log functions used to publish events to j1
  stepStart: StepLogFunction<TStepExecutionContext>;
  stepSuccess: StepLogFunction<TStepExecutionContext>;
  stepFailure: StepLogFunctionWithError<TStepExecutionContext>;
  synchronizationUploadStart: SynchronizationLogFunction;
  synchronizationUploadEnd: SynchronizationLogFunction;
  validationFailure: ValidationLogFunction;

  // flushes the queue of work to ensure that
  // all events have been published
  flush: () => Promise<void>;
}
