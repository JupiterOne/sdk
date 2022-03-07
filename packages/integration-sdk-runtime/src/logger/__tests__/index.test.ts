import Logger from 'bunyan';
import { Writable } from 'stream';

import {
  IntegrationErrorEventName,
  IntegrationInfoEventName,
  IntegrationInvocationConfig,
  IntegrationLocalConfigFieldMissingError,
  IntegrationProviderAuthenticationError,
  IntegrationProviderAuthorizationError,
  IntegrationStep,
  IntegrationValidationError,
  IntegrationWarnEventName,
  PublishEventLevel,
  SynchronizationJob,
  UNEXPECTED_ERROR_CODE,
  UNEXPECTED_ERROR_REASON,
} from '@jupiterone/integration-sdk-core';

import {
  createErrorEventDescription,
  createIntegrationLogger,
  IntegrationLogger,
  PROVIDER_AUTH_ERROR_HELP,
} from '../../logger';

const invocationConfig = {} as IntegrationInvocationConfig;
const name = 'integration-logger';

describe('isHandledError', () => {
  const integrationLogger = createIntegrationLogger({
    name,
    invocationConfig,
  });

  test('error() tracks args[0].err property', () => {
    const err = new Error('Something bad');
    integrationLogger.error({ err });
    expect(integrationLogger.isHandledError(err)).toBe(true);
  });

  test('error() tracks args[0]', () => {
    const err = new Error('Something bad');
    integrationLogger.error(err);
    expect(integrationLogger.isHandledError(err)).toBe(true);
  });

  test('warn() tracks args[0].err property', () => {
    const err = new Error('Something bad');
    integrationLogger.warn({ err });
    expect(integrationLogger.isHandledError(err)).toBe(true);
  });

  test('warn() tracks args[0]', () => {
    const err = new Error('Something bad');
    integrationLogger.warn(err);
    expect(integrationLogger.isHandledError(err)).toBe(true);
  });
});

describe('logger.trace', () => {
  test('includes verbose: true for downstream verbose log pruning', () => {
    const integrationLogger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    const stream = (integrationLogger as any)._logger.streams[0]
      .stream as Logger.RingBuffer;

    integrationLogger.trace();
    expect(stream.records).toEqual([]);

    integrationLogger.trace({ stuff: 'yo!' }, 'Me message');
    integrationLogger.trace(Error('Yo!'), 'Me message');
    integrationLogger.trace('formatit', 'Me message');

    expect(stream.records).toEqual([
      expect.objectContaining({
        stuff: 'yo!',
        verbose: true,
        msg: 'Me message',
      }),
      expect.objectContaining({
        err: expect.objectContaining({
          message: 'Yo!',
        }),
        verbose: true,
        msg: 'Me message',
      }),
      expect.objectContaining({
        verbose: true,
        msg: 'formatit Me message',
      }),
    ]);
  });

  test('logger.child.trace', () => {
    const integrationLogger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    const childLogger = integrationLogger.child({
      mostuff: 'smile',
    });
    const stream = (childLogger as any)._logger.streams[0]
      .stream as Logger.RingBuffer;

    integrationLogger.trace();
    childLogger.trace();
    expect(stream.records).toEqual([]);

    integrationLogger.trace({ stuff: 'parents right?' }, 'Dad joke');
    childLogger.trace({ stuff: 'yo!' }, 'Me message');
    expect(stream.records).toEqual([
      expect.objectContaining({
        stuff: 'parents right?',
        verbose: true,
        msg: 'Dad joke',
      }),
      expect.objectContaining({
        stuff: 'yo!',
        mostuff: 'smile',
        verbose: true,
        msg: 'Me message',
      }),
    ]);
    expect(stream.records[0].mostuff).toBeUndefined();
  });
});

describe('createIntegrationLogger', () => {
  let addSerializers: jest.Mock;

  beforeEach(() => {
    addSerializers = jest.fn();
    jest.spyOn(Logger, 'createLogger').mockReturnValue({
      addSerializers,
    } as unknown as Logger);
  });

  test('installs expected properties', () => {
    createIntegrationLogger({ name, invocationConfig });

    expect(Logger.createLogger).toHaveBeenCalledWith({
      name: 'integration-logger',
      level: 'info',
      serializers: {
        err: Logger.stdSerializers.err,
      },
    });
  });

  test('allows pretty option to be specified', () => {
    createIntegrationLogger({
      name,
      invocationConfig,
      pretty: true,
    });

    expect(Logger.createLogger).toHaveBeenCalledTimes(1);
    expect(Logger.createLogger).toHaveBeenCalledWith({
      name: 'integration-logger',
      level: 'info',
      serializers: {
        err: Logger.stdSerializers.err,
      },
      streams: [{ stream: expect.any(Writable) }],
    });
  });

  test('adds provided serializers', () => {
    createIntegrationLogger({
      name,
      invocationConfig,
      serializers: {},
    });

    expect(addSerializers).toHaveBeenCalledTimes(1);
    expect(addSerializers).toHaveBeenCalledWith({
      integrationInstanceConfig: expect.any(Function),
      instance: expect.any(Function),
    });
  });

  describe('integrationInstanceConfig serializer', () => {
    test('is a function', () => {
      createIntegrationLogger({ name, invocationConfig });

      expect(addSerializers).toHaveBeenNthCalledWith(1, {
        integrationInstanceConfig: expect.any(Function),
        instance: expect.any(Function),
      });
    });

    test('handles undefined config', () => {
      createIntegrationLogger({ name, invocationConfig });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;
      expect(serializer(undefined)).toEqual(undefined);
    });

    test('handles null config', () => {
      createIntegrationLogger({ name, invocationConfig });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(serializer(null)).toEqual(null);
    });

    test('masks everything when field metadata not provided', () => {
      createIntegrationLogger({ name, invocationConfig });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(serializer({ anything: 'bob', everything: 'jane' })).toEqual({
        anything: '***',
        everything: '***',
      });
    });

    test('shows unmasked data', () => {
      createIntegrationLogger({
        name,
        invocationConfig: {
          ...invocationConfig,
          instanceConfigFields: {
            masked: {
              mask: true,
            },
            unmasked: {
              mask: false,
            },
          },
        },
      });
      const serializer = addSerializers.mock.calls[0][0]
        .integrationInstanceConfig as Function;

      expect(
        serializer({
          anything: 'bob',
          masked: 'this is secret',
          unmasked: 'this is clear',
        }),
      ).toEqual({
        anything: '***',
        masked: '***',
        unmasked: 'this is clear',
      });
    });
  });
});

describe('step event publishing', () => {
  test('writes logs for stepEnd, stepStart, and stepFailure events', () => {
    const logger = createIntegrationLogger({ name, invocationConfig });

    const infoSpy = jest.spyOn(logger, 'info');
    const errorSpy = jest.spyOn(logger, 'error');

    const step: IntegrationStep = {
      id: 'a',
      name: 'Mochi',
      entities: [],
      relationships: [],
      dependsOn: [],
      executionHandler: jest.fn(),
    };

    logger.stepStart(step);
    logger.stepSuccess(step);

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenNthCalledWith(1, `Starting step "Mochi"...`);
    expect(infoSpy).toHaveBeenNthCalledWith(2, `Completed step "Mochi".`);

    const error = new IntegrationLocalConfigFieldMissingError('ripperoni');
    logger.stepFailure(step, error);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      {
        err: error,
        errorId: expect.any(String),
      },
      expect.stringContaining(
        `Step "Mochi" failed to complete due to error. (errorCode="${error.code}"`,
      ),
    );
  });

  test('posts events via api client if synchronizationContext is registered', () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('event', onEmitEvent);

    const step: IntegrationStep = {
      id: 'a',
      name: 'Mochi',
      entities: [],
      relationships: [],
      dependsOn: [],
      executionHandler: jest.fn(),
    };

    logger.stepStart(step);
    logger.stepSuccess(step);

    // just use some error that contains a code
    const error = new IntegrationLocalConfigFieldMissingError('ripperoni');
    logger.stepFailure(step, error);

    expect(onEmitEvent).toHaveBeenCalledTimes(3);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'step_start',
      level: PublishEventLevel.Info,
      description: 'Starting step "Mochi"...',
    });
    expect(onEmitEvent).toHaveBeenNthCalledWith(2, {
      name: 'step_end',
      level: PublishEventLevel.Info,
      description: 'Completed step "Mochi".',
    });
    expect(onEmitEvent).toHaveBeenNthCalledWith(3, {
      name: 'step_failure',
      level: PublishEventLevel.Error,
      description: expect.stringMatching(
        new RegExp(
          `Step "Mochi" failed to complete due to error. \\(errorCode="${error.code}", errorId="(.*)"\\)$`,
        ),
      ),
    });
  });
});

describe('provider auth error details', () => {
  const step: IntegrationStep = {
    id: 'a',
    name: 'Mochi',
    entities: [],
    relationships: [],
    dependsOn: [],
    executionHandler: jest.fn(),
  };

  let onEmitEvent: jest.MockedFunction<any>;
  let logger: IntegrationLogger;

  beforeEach(() => {
    onEmitEvent = jest.fn();
    logger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    logger.on('event', onEmitEvent);
  });

  const errorDetails = {
    endpoint: 'https://cute.af',
    status: 403,
    statusText: 'Forbidden',
  };

  [
    {
      error: new IntegrationProviderAuthenticationError(errorDetails),
      expectedReason:
        'Provider authentication failed at https://cute.af: 403 Forbidden',
    },
    {
      error: new IntegrationProviderAuthorizationError(errorDetails),
      expectedReason:
        'Provider authorization failed at https://cute.af: 403 Forbidden',
    },
  ].forEach(({ error, expectedReason }) => {
    test(`stepFailure adds additional information to the log message if an ${error.code} error is provided`, () => {
      logger.stepFailure(step, error);

      expect(onEmitEvent).toHaveBeenCalledWith({
        name: 'step_failure',
        level: PublishEventLevel.Error,
        description: expect.stringMatching(
          new RegExp(
            '^Step "Mochi" failed to complete due to error.' +
              PROVIDER_AUTH_ERROR_HELP +
              ` \\(errorCode="${error.code}", errorId="[^"]*", reason="${expectedReason}"\\)$`,
          ),
        ),
      });
    });

    test(`validationFailure adds additional information to the log message if an ${error.code} error is provided`, () => {
      logger.validationFailure(error);

      expect(onEmitEvent).toHaveBeenCalledWith({
        name: 'validation_failure',
        level: PublishEventLevel.Error,
        description: expect.stringMatching(
          new RegExp(
            '^Error occurred while validating integration configuration.' +
              PROVIDER_AUTH_ERROR_HELP +
              ` \\(errorCode="${error.code}", errorId="[^"]*", reason="${expectedReason}"\\)$`,
          ),
        ),
      });
    });
  });
});

describe('sync upload logging', () => {
  test('posts events to api client', () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    logger.on('event', onEmitEvent);

    const job = { id: 'test-job-id' } as SynchronizationJob;

    logger.synchronizationUploadStart(job);
    logger.synchronizationUploadEnd(job);

    expect(onEmitEvent).toHaveBeenCalledTimes(2);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'sync_upload_start',
      level: PublishEventLevel.Info,
      description: 'Uploading collected data for synchronization...',
    });
    expect(onEmitEvent).toHaveBeenNthCalledWith(2, {
      name: 'sync_upload_end',
      level: PublishEventLevel.Info,
      description: 'Upload complete.',
    });
  });
});

describe('validation failure logging', () => {
  test('unexpected error', () => {
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    const onEmitEvent = jest.fn();
    logger.on('event', onEmitEvent);

    const errorSpy = jest.spyOn(logger, 'error');

    const error = new Error('WAT?');
    const expectedDescriptionRegex = new RegExp(
      `Error occurred while validating integration configuration. \\(errorCode="UNEXPECTED_ERROR", errorId="(.*)", reason="Unexpected error .*?"\\)$`,
    );

    logger.validationFailure(error);

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'validation_failure',
      level: PublishEventLevel.Error,
      description: expect.stringMatching(expectedDescriptionRegex),
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      { errorId: expect.any(String), err: error },
      expect.stringMatching(expectedDescriptionRegex),
    );
  });

  test('expected user error', () => {
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    const onEmitEvent = jest.fn();
    logger.on('event', onEmitEvent);

    const warnSpy = jest.spyOn(logger, 'warn');

    const error = new IntegrationValidationError('Bad Mochi');
    const expectedDescriptionRegex = new RegExp(
      `Error occurred while validating integration configuration. \\(errorCode="${error.code}", errorId="(.*)", reason="Bad Mochi"\\)$`,
    );

    logger.validationFailure(error);

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenNthCalledWith(1, {
      name: 'validation_failure',
      level: PublishEventLevel.Error,
      description: expect.stringMatching(expectedDescriptionRegex),
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      { errorId: expect.any(String), err: error },
      expect.stringMatching(expectedDescriptionRegex),
    );
  });
});

describe('createErrorEventDescription', () => {
  test('supplies default reason if an error without a code is provided', () => {
    const error = new Error('soba');

    const { description, errorId } = createErrorEventDescription(
      error,
      'testing',
    );
    expect(description).toEqual(
      `testing (errorCode="${UNEXPECTED_ERROR_CODE}", errorId="${errorId}", reason="${UNEXPECTED_ERROR_REASON}")`,
    );
  });

  test('displays code and message from error if error is an integration error', () => {
    const error = new IntegrationValidationError('soba');

    const { description, errorId } = createErrorEventDescription(
      error,
      'testing',
    );
    expect(description).toEqual(
      `testing (errorCode="${error.code}", errorId="${errorId}", reason="soba")`,
    );
  });
});

describe('publishMetric', () => {
  test('emits a "metric" event when called', () => {
    const onEmitMetric = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('metric', onEmitMetric);

    logger.publishMetric({
      name: 'metric',
      value: 1000,
      unit: 'Milliseconds',
    });

    expect(onEmitMetric).toHaveBeenCalledWith({
      name: 'metric',
      value: 1000,
      unit: 'Milliseconds',
      timestamp: expect.any(Number),
    });
  });

  test('emits a "metric" event when called with child logger', () => {
    const onEmitMetric = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('metric', onEmitMetric);

    logger.child({}).publishMetric({
      name: 'metric',
      value: 1000,
      unit: 'Milliseconds',
    });

    expect(onEmitMetric).toHaveBeenCalledWith({
      name: 'metric',
      value: 1000,
      unit: 'Milliseconds',
      timestamp: expect.any(Number),
    });
  });

  test('logs the metric', () => {
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    const infoSpy = jest.spyOn(logger, 'info');

    logger.publishMetric({
      name: 'metric',
      value: 1000,
      unit: 'Milliseconds',
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      {
        metric: {
          name: 'metric',
          value: 1000,
          unit: 'Milliseconds',
          timestamp: expect.any(Number),
        },
      },
      'Collected metric.',
    );
  });
});

describe('#publishEvent', () => {
  test('should support publishEvent(...) function', () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('event', onEmitEvent);

    logger.publishEvent({
      name: 'the name',
      description: 'the description',
    });

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenCalledWith({
      name: 'the name',
      level: PublishEventLevel.Info,
      description: 'the description',
    });
  });

  test('should support publishInfoEvent(...) function', () => {
    const onEmitEvent = jest.fn();

    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    logger.on('event', onEmitEvent);

    logger.publishInfoEvent({
      name: IntegrationInfoEventName.Stats,
      description: 'the description',
    });

    expect(onEmitEvent).toHaveBeenCalledTimes(1);
    expect(onEmitEvent).toHaveBeenCalledWith({
      name: IntegrationInfoEventName.Stats,
      level: PublishEventLevel.Info,
      description: 'the description',
    });
  });

  test.each(Object.keys(IntegrationWarnEventName))(
    'should support publishWarnEvent(...) function using %p event type',
    (key) => {
      const onEmitEvent = jest.fn();

      const logger = createIntegrationLogger({
        name,
        invocationConfig,
      });

      logger.on('event', onEmitEvent);
      logger.publishWarnEvent({
        name: IntegrationWarnEventName[key],
        description: 'the description',
      });

      expect(onEmitEvent).toHaveBeenCalledTimes(1);
      expect(onEmitEvent).toHaveBeenCalledWith({
        name: IntegrationWarnEventName[key],
        level: PublishEventLevel.Warn,
        description: 'the description',
      });
    },
  );

  test.each(Object.keys(IntegrationErrorEventName))(
    'should support publishErrorEvent(...) function using %p event type',
    (key) => {
      const onEmitEvent = jest.fn();

      const logger = createIntegrationLogger({
        name,
        invocationConfig,
      });

      logger.on('event', onEmitEvent);
      logger.publishErrorEvent({
        name: IntegrationErrorEventName[key],
        description: 'the description',
      });

      expect(onEmitEvent).toHaveBeenCalledTimes(1);

      expect(onEmitEvent).toHaveBeenCalledWith({
        name: IntegrationErrorEventName[key],
        level: PublishEventLevel.Error,
        description: 'the description',
      });
    },
  );
});

describe('#handleFailure', () => {
  test('should maintain onFailure implementation when calling logger.child()', () => {
    const onFailureSpy = jest.fn();
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
      onFailure: onFailureSpy,
    });

    const childLogger = logger.child();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Property 'onFailure' is private and only accessible within class 'IntegrationLogger'.ts(2341)
    childLogger.onFailure({
      err: new Error(),
    });

    expect(onFailureSpy).toHaveBeenCalledTimes(1);
  });

  test('should invoke publishEvent', () => {
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    const publishEventSpy = jest.spyOn(logger, 'publishEvent');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Property 'handleFailure' is private and only accessible within class 'IntegrationLogger'.ts(2341)
    logger.handleFailure({
      err: new Error(),
      errorId: 'SOME_ERROR_ID',
      eventName: 'step_failure',
      description: 'an error :(',
    });

    expect(publishEventSpy).toHaveBeenCalledTimes(1);
  });

  test('should log as error and invoke onFailure when error is meant to be handled by an operator', () => {
    const onFailureSpy = jest.fn();
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
      onFailure: onFailureSpy,
    });

    const errorSpy = jest.spyOn(logger, 'error');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Property 'handleFailure' is private and only accessible within class 'IntegrationLogger'.ts(2341)
    logger.handleFailure({
      err: new Error(),
      errorId: 'SOME_ERROR_ID',
      eventName: 'step_failure',
      description: 'an error :(',
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(onFailureSpy).toHaveBeenCalledTimes(1);
  });

  test('should log as warn and NOT invoke onFailure callback when error is meant to be handled by a user', () => {
    const onFailureSpy = jest.fn();
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
      onFailure: onFailureSpy,
    });

    const warnSpy = jest.spyOn(logger, 'warn');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Property 'handleFailure' is private and only accessible within class 'IntegrationLogger'.ts(2341)
    logger.handleFailure({
      err: new IntegrationValidationError(''),
      errorId: 'SOME_ERROR_ID',
      eventName: 'step_failure',
      description: 'an error :(',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(onFailureSpy).not.toHaveBeenCalled();
  });

  test('should invoke handleFailure on validationFailure', () => {
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Argument of type '"handleFailure"' is not assignable to parameter of type 'never'.ts(2769)
    const handleFailureSpy = jest.spyOn(logger, 'handleFailure');

    logger.validationFailure(new Error());

    expect(handleFailureSpy).toHaveBeenCalledTimes(1);
  });

  test('should invoke handleFailure on stepFailure', () => {
    const logger = createIntegrationLogger({
      name,
      invocationConfig,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // Argument of type '"handleFailure"' is not assignable to parameter of type 'never'.ts(2769)
    const handleFailureSpy = jest.spyOn(logger, 'handleFailure');

    logger.stepFailure(
      { id: 'step-id', name: 'step-name', entities: [], relationships: [] },
      new Error(),
    );

    expect(handleFailureSpy).toHaveBeenCalledTimes(1);
  });
});
