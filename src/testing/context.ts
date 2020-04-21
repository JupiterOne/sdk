import {
  IntegrationInstance,
  IntegrationExecutionContext,
  IntegrationStepExecutionContext,
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
} from '../framework';

import { loadInstanceConfigFields } from '../framework/config';
import { loadConfigFromEnvironmentVariables } from '../framework/execution/config';
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
  const instance = {
    ...LOCAL_INTEGRATION_INSTANCE,
  };

  if (instanceConfig) {
    instance.config = instanceConfig;
  } else {
    const configFields = loadInstanceConfigFields();
    if (configFields) {
      try {
        instance.config = loadConfigFromEnvironmentVariables(configFields);
      } catch (err) {
        // failed to load configuration, not end of the world
        // because this is only used in testing
        //
        // For convenience, we will generate a config for the developer
        //
        // this would generally only happen when a developer does not
        // have an .env file configured or when an integration's test suite
        // runs in CI
        instance.config = generateInstanceConfig(configFields);
      }
    }
  }

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

function generateInstanceConfig(
  configFields: IntegrationInstanceConfigFieldMap,
): IntegrationInstance['config'] {
  return Object.entries(configFields).reduce(
    (acc: IntegrationInstance['config'], [field, config]) => {
      acc[field] = getInstanceConfigValueFromType(config);
      return acc;
    },
    {},
  );
}

function getInstanceConfigValueFromType(
  config: IntegrationInstanceConfigField,
) {
  switch (config.type) {
    case 'boolean':
      return true;
    case 'string':
    default:
      return 'STRING_VALUE';
  }
}
