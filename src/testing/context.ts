import { IntegrationInstance, IntegrationExecutionContext } from '../framework';

import { LOCAL_INTEGRATION_INSTANCE } from '../framework/execution/instance';

import { createMockIntegrationLogger } from './logger';

interface CreateMockExecutionContextOptions {
  instanceConfig?: IntegrationInstance['config'];
}

export function createMockExecutionContext({
  instanceConfig,
}: CreateMockExecutionContextOptions = {}): IntegrationExecutionContext {
  const logger = createMockIntegrationLogger();
  // copy local instance properties so that tests cannot
  // mutate the original object and cause unpredicable behavior
  const instance = { ...LOCAL_INTEGRATION_INSTANCE, config: instanceConfig };

  return {
    logger,
    instance,
  };
}
