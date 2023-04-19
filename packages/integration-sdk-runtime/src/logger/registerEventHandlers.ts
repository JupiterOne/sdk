import { IntegrationLogger } from '.';

type EventType = 'multipleResolves' | 'uncaughtException';

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
export function registerEventHandlers(
  callback: LifecycleErrorCallback,
): RegisteredEventListeners {
  const multipleResolveListener = createMultipleResolveListener(callback);
  process.on('multipleResolves', multipleResolveListener);
  const uncaughtExceptionListener = createUncaughtExceptionListener(callback);
  process.on('uncaughtException', uncaughtExceptionListener);
  return {
    multipleResolveListener,
    uncaughtExceptionListener,
  };
}

/**
 * Call this function before exiting the node process when using `registerEventHandlers`
 */
export function unregisterEventHandlers({
  multipleResolveListener,
  uncaughtExceptionListener,
}: RegisteredEventListeners) {
  process.nextTick(() => {
    process.removeListener('multipleResolves', multipleResolveListener);
    process.removeListener('uncaughtException', uncaughtExceptionListener);
  });
}

interface ErrorLogger {
  error: IntegrationLogger['error'];
  onFailure?: IntegrationLogger['onFailure'];
}

function integrationLoggerEventHandlerCallback(
  getErrorLogger: () => ErrorLogger,
): LifecycleErrorCallback {
  return (err, event) => {
    const logger = getErrorLogger();
    logger.error({ err, event });
    // multipleResolves is excluded from `onFailure` as it is
    // not a strict failure and is at times even expected behavior
    // in node-fetch, Promise.all, and Promise.race
    if (logger.onFailure && event !== 'multipleResolves') {
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
  getErrorLogger: () => ErrorLogger,
): RegisteredEventListeners {
  return registerEventHandlers(
    integrationLoggerEventHandlerCallback(getErrorLogger),
  );
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
