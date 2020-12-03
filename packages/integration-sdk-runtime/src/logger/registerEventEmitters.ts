import { IntegrationLogger } from '.';

type LifecycleErrorCallback = (err: Error) => void;

function multipleResolveListener(callback: LifecycleErrorCallback) {
  // conforms to type MultipleResolveListener, see node_modules/@types/node/globals.d.ts
  return (type: 'resolve' | 'reject', promise: Promise<any>, value: any) => {
    if (type === 'reject') {
      callback(value);
    }
  };
}

function unhandledRejectionListener(callback: LifecycleErrorCallback) {
  // conforms to type UnhandledRejectionListener, see node_modules/@types/node/globals.d.ts
  return (reason: {} | null | undefined, promise: Promise<any>) => {
    callback(reason as Error);
  };
}

function uncaughtExceptionListener(callback: LifecycleErrorCallback) {
  // conforms to type UncaughtExceptionListener, see node_modules/@types/node/globals.d.ts
  return (error: Error) => {
    callback(error);
  };
}

/**
 * Because individual integrations contain code in their `validateInvocation` and `integrationSteps`
 * that could include unhandled rejections or multiple resolves, this function is exported as a convenience
 * to catch and handle events emitted from an integration. This emitter should be instrumented as early
 * as possible in the node process in order to handle any instrumentation exceptions.
 *
 * Before exiting the node process, unregister these event emitters using `unregisterEventEmitters`
 */
export function registerEventEmitters(callback: LifecycleErrorCallback) {
  process.on('multipleResolves', multipleResolveListener(callback));
  process.on('unhandledRejection', unhandledRejectionListener(callback));
  process.on('uncaughtException', uncaughtExceptionListener(callback));
}

/**
 * Call this function before exiting the node process when using `registerEventEmitters`
 */
export function unregisterEventEmitters(callback: LifecycleErrorCallback) {
  process.nextTick(() => {
    process.removeListener(
      'multipleResolves',
      multipleResolveListener(callback),
    );
    process.removeListener(
      'unhandledRejection',
      unhandledRejectionListener(callback),
    );
    process.removeListener(
      'uncaughtException',
      uncaughtExceptionListener(callback),
    );
  });
}

function integrationLoggerEventEmitterCallback(
  getLogger: () => Pick<IntegrationLogger, 'error'>,
): LifecycleErrorCallback {
  return (err: Error) => getLogger().error(err);
}

/**
 * Most often, unhandled rejections should be handled using logger.error().
 * As a convenience, registerIntegrationLoggerEventEmitters passes logger.error() as the callback
 * to registerEventEmitters.
 *
 * Before exiting the node process, unregister these event emitters using
 * `unregisterIntegrationLoggerEventEmitters`
 */
export function registerIntegrationLoggerEventEmitters(
  getLogger: () => Pick<IntegrationLogger, 'error'>,
) {
  registerEventEmitters(integrationLoggerEventEmitterCallback(getLogger));
}

/**
 * Call this function before exiting the node process when using `registerIntegrationLoggerEventEmitters`
 */
export function unregisterIntegrationLoggerEventEmitters(
  getLogger: () => Pick<IntegrationLogger, 'error'>,
) {
  unregisterEventEmitters(integrationLoggerEventEmitterCallback(getLogger));
}
