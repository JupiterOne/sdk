import {
  IntegrationInstance,
  IntegrationExecutionContext,
  IntegrationStepExecutionContext,
} from '../framework';

import { LOCAL_INTEGRATION_INSTANCE } from '../framework/execution/instance';

import { createMockIntegrationLogger } from './logger';
import {
  MockJobState,
  createMockJobState,
  CreateMockJobStateOptions,
} from './jobState';

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

type CreateMockStepExecutionContextOptions = CreateMockExecutionContextOptions &
  CreateMockJobStateOptions;

interface MockIntegrationStepExecutionContext
  extends IntegrationStepExecutionContext {
  jobState: MockJobState;
}

export function createMockStepExecutionContext(
  options: CreateMockStepExecutionContextOptions = {},
): MockIntegrationStepExecutionContext {
  return {
    ...createMockExecutionContext(options),
    jobState: createMockJobState(options),
  };
}
