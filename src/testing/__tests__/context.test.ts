import noop from 'lodash/noop';

import { LOCAL_INTEGRATION_INSTANCE } from '../../framework/execution/instance';

import { createMockExecutionContext } from '../context';

test('generates an execution context with a fake logger', () => {
  const { logger } = createMockExecutionContext();

  Object.keys(logger).forEach((key) => {
    if (key !== 'child') {
      expect(logger[key]).toEqual(noop);
    }
  });

  expect(logger.child({})).toEqual(logger);
});

test('generates an execution context with the integration instance used for local development', () => {
  const { instance } = createMockExecutionContext();
  expect(instance).toEqual(LOCAL_INTEGRATION_INSTANCE);
});
