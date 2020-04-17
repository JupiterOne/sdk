import noop from 'lodash/noop';

import { Entity, Relationship, IntegrationStep } from '../../framework';
import { LOCAL_INTEGRATION_INSTANCE } from '../../framework/execution/instance';

import {
  createMockExecutionContext,
  createMockStepExecutionContext,
} from '../context';

/**
 * Ensure that both createMockExecutionContext and
 * createMockStepExecutionContext functions return
 * an integration logger and instance.
 *
 * Also ensure that they can accept the `instanceConfig` option.
 */
[createMockExecutionContext, createMockStepExecutionContext].forEach(
  (createContext) => {
    describe(createContext.name, () => {
      test('generates an execution context with a fake logger', () => {
        const { logger } = createContext();

        Object.keys(logger).forEach((key) => {
          if (key !== 'child') {
            expect(logger[key]).toEqual(noop);
          }
        });

        expect(logger.child({})).toEqual(logger);
      });

      test('generates an execution context with the integration instance used for local development', () => {
        const { instance } = createContext();
        expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
      });

      test('accepts an instanceConfig for prepopulating configuration values', () => {
        const config = { test: true };
        const { instance } = createContext({ instanceConfig: config });
        expect(instance).toEqual({ ...LOCAL_INTEGRATION_INSTANCE, config });
      });
    });
  },
);

describe('createMockStepExecutionContext', () => {
  test('accepts entities and relationships to initialize job state with', async () => {
    const entities: Entity[] = [
      {
        _key: 'test',
        _type: 'test_entity',
        _class: 'Resource',
      },
    ];

    const relationships: Relationship[] = [
      {
        _key: 'a|has|b',
        _type: 'test_relationship',
        _class: 'HAS',
        _fromEntityKey: 'a',
        _toEntityKey: 'b',
      },
    ];

    const { jobState } = createMockStepExecutionContext();

    jobState.addEntities(entities);
    jobState.addRelationships(relationships);

    expect(jobState.collectedEntities).toEqual(entities);
    expect(jobState.collectedRelationships).toEqual(relationships);
  });

  test('fits into the integration step interface', async () => {
    expect.assertions(0);

    const step: IntegrationStep = {
      id: 'step-a',
      name: 'My step',
      types: [],
      executionHandler() {
        return Promise.resolve();
      },
    };

    const context = createMockStepExecutionContext();
    await step.executionHandler(context);
  });
});
