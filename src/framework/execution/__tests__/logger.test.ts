import { Writable } from 'stream';
import noop from 'lodash/noop';

import { createIntegrationLogger } from '../logger';
import Logger from 'bunyan';
import { IntegrationInvocationConfig, IntegrationStep } from '../types';
import {
  SynchronizationJobContext,
  SynchronizationJob,
} from '../../synchronization';
import { createApiClient } from '../../api';

const invocationConfig = {} as IntegrationInvocationConfig;
const name = 'integration-logger';

describe('logger.trace', () => {
  test('includes verbose: true for downstream verbose log pruning', () => {
    const integrationLogger = createIntegrationLogger({
      name,
      invocationConfig,
    });
    const stream = (integrationLogger as any).streams[0]
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
    const stream = (childLogger as any).streams[0].stream as Logger.RingBuffer;

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
    jest.spyOn(Logger, 'createLogger').mockReturnValue(({
      addSerializers,
    } as unknown) as Logger);
  });

  test('installs expected properties', async () => {
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
    expect(addSerializers).toHaveBeenLastCalledWith({});
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
        masked: '****cret',
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
      types: [],
      dependsOn: [],
      executionHandler: jest.fn(),
    };

    logger.stepStart(step);
    logger.stepSuccess(step);

    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).toHaveBeenNthCalledWith(
      1,
      {
        step: step.id,
      },
      `Starting step "Mochi"...`,
    );
    expect(infoSpy).toHaveBeenNthCalledWith(
      2,
      {
        step: step.id,
      },
      `Completed step "Mochi".`,
    );

    const error = new Error('ripperoni');
    logger.stepFailure(step, error);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      {
        err: error,
        step: step.id,
      },
      `Step "Mochi" failed to complete due to error.`,
    );
  });

  test('posts events via api client if synchronizationContext is registered', async () => {
    const logger = createIntegrationLogger({ name, invocationConfig });
    const context: SynchronizationJobContext = {
      logger,
      job: { id: 'test-job-id' } as SynchronizationJob,
      apiClient: createApiClient({
        apiBaseUrl: 'https://api.us.jupiterone.io',
        account: 'mocheronis',
      }),
    };

    logger.registerSynchronizationJobContext(context);

    const postSpy = jest
      .spyOn(context.apiClient, 'post')
      .mockImplementation(noop as any);

    const step: IntegrationStep = {
      id: 'a',
      name: 'Mochi',
      types: [],
      dependsOn: [],
      executionHandler: jest.fn(),
    };

    logger.stepStart(step);
    logger.stepSuccess(step);
    const error = new Error('ripperoni');
    logger.stepFailure(step, error);

    await logger.flush();

    const expectedEventsUrl =
      '/persister/synchronization/jobs/test-job-id/events';

    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(postSpy).toHaveBeenNthCalledWith(1, expectedEventsUrl, {
      events: [{ name: 'step-start', description: 'Starting step "Mochi"...' }],
    });
    expect(postSpy).toHaveBeenNthCalledWith(2, expectedEventsUrl, {
      events: [{ name: 'step-end', description: 'Completed step "Mochi".' }],
    });
    expect(postSpy).toHaveBeenNthCalledWith(3, expectedEventsUrl, {
      events: [
        {
          name: 'step-failure',
          description: 'Step "Mochi" failed to complete due to error.',
        },
      ],
    });
  });
});
