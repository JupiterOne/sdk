import { IntegrationLogger } from '.';

type EventType =
  | 'multipleResolves'
  | 'unhandledRejection'
  | 'uncaughtException';

type LifecycleErrorCallback = (err: Error, event: EventType) => void;

// conforms to type MultipleResolveListener, see node_modules/@types/node/globals.d.ts
type MultipleResolveListener = (
  type: 'resolve' | 'reject',
  promise: Promise<any>,
  value: any,
) => void;

function createMultipleResolveListener(
  callback: LifecycleErrorCallback,
): MultipleResolveListener {
  return (type, promise, value) => {
    if (type === 'reject') {
      callback(value, 'multipleResolves');
    }
  };
}

// conforms to type UnhandledRejectionListener, see node_modules/@types/node/globals.d.ts
type UnhandledRejectionListener = (
  reason: {} | null | undefined,
  promise: Promise<any>,
) => void;

function createUnhandledRejectionListener(
  callback: LifecycleErrorCallback,
): UnhandledRejectionListener {
  return (reason, promise) => {
    callback(reason as Error, 'unhandledRejection');
  };
}

// conforms to type UncaughtExceptionListener, see node_modules/@types/node/globals.d.ts
type UncaughtExceptionListener = (error: Error) => void;

function createUncaughtExceptionListener(
  callback: LifecycleErrorCallback,
): UncaughtExceptionListener {
  return (error) => {
    callback(error, 'uncaughtException');
  };
}

interface RegisteredEventListeners {
  multipleResolveListener: MultipleResolveListener;
  unhandledRejectionListener: UnhandledRejectionListener;
  uncaughtExceptionListener: UncaughtExceptionListener;
}

/**
 * Because individual integrations contain code in their `validateInvocation` and `integrationSteps`
 * that could include unhandled rejections or multiple resolves, this function is exported as a convenience
 * to catch and handle events emitted from an integration. This emitter should be instrumented as early
 * as possible in the node process in order to handle any instrumentation exceptions.
 *
 * Before exiting the node process, unregister these event handlers using `unregisterEventHandlers`
 * 
 * @param callback
 * @returns {RegisteredEventListeners} Pass these listeners into `unregisterEventHandlers`
 */
export function registerEventHandlers(callback: LifecycleErrorCallback): RegisteredEventListeners {
  const multipleResolveListener = createMultipleResolveListener(callback);
  process.on('multipleResolves', multipleResolveListener);
  const unhandledRejectionListener = createUnhandledRejectionListener(callback);
  process.on('unhandledRejection', unhandledRejectionListener);
  const uncaughtExceptionListener = createUncaughtExceptionListener(callback);
  process.on('uncaughtException', uncaughtExceptionListener);
  return {
    multipleResolveListener,
    unhandledRejectionListener,
    uncaughtExceptionListener,
  };
}

/**
 * Call this function before exiting the node process when using `registerEventHandlers`
 */
export function unregisterEventHandlers({
  multipleResolveListener,
  unhandledRejectionListener,
  uncaughtExceptionListener,
}: RegisteredEventListeners) {
  process.nextTick(() => {
    process.removeListener('multipleResolves', multipleResolveListener);
    process.removeListener('unhandledRejection', unhandledRejectionListener);
    process.removeListener('uncaughtException', uncaughtExceptionListener);
  });
}

interface MinimalLogger {
  error: IntegrationLogger['error'];
  onFailure?: IntegrationLogger['onFailure'];
}

function integrationLoggerEventHandlerCallback(
  getLogger: () => MinimalLogger,
): LifecycleErrorCallback {
  return (err, event) => {
    const logger = getLogger();
    logger.error({ err, event });
    if (logger.onFailure) {
      logger.onFailure({ err });
    }
  };
}

/**
 * Most often, unhandled rejections should be handled using logger.error().
 * As a convenience, registerIntegrationLoggerEventHandlers passes logger.error() as the callback
 * to registerEventHandlers.
 *
 * Before exiting the node process, unregister these event handlers using
 * `unregisterIntegrationLoggerEventHandlers`
 */
export function registerIntegrationLoggerEventHandlers(
  getLogger: () => MinimalLogger,
): RegisteredEventListeners {
  return registerEventHandlers(integrationLoggerEventHandlerCallback(getLogger));
}

/**
 * Call this function before exiting the node process when using `registerIntegrationLoggerEventHandlers`
 * 
 * This function is an alias for `unregisterEventHandlers`, useful for maintaining consistency in 
 * `register*` / `unregister*` functions in calling code.
 * 
 * @see unregisterEventHandlers
 */
export const unregisterIntegrationLoggerEventHandlers = unregisterEventHandlers;
