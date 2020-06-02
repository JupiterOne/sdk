import {
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
  IntegrationStepExecutionContext,
  IntegrationExecutionContext,
} from '@jupiterone/integration-sdk-core';
import {
  LOCAL_INTEGRATION_INSTANCE,
  loadConfigFromEnvironmentVariables,
} from '@jupiterone/integration-sdk-runtime';

import {
  createMockJobState,
  CreateMockJobStateOptions,
  MockJobState,
} from './jobState';
import { createMockIntegrationLogger } from './logger';

export type CreateMockExecutionContextOptions<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> =
  | CreateMockExecutionContextOptionsWithInstanceConfig<TConfig>
  | CreateMockExecutionContextOptionsWithInstanceConfigFields;

interface CreateMockExecutionContextOptionsWithInstanceConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> {
  instanceConfig: TConfig;
}

interface CreateMockExecutionContextOptionsWithInstanceConfigFields {
  instanceConfigFields: IntegrationInstanceConfigFieldMap;
}

export function createMockExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>(
  options: CreateMockExecutionContextOptions<TConfig> = {
    instanceConfigFields: {},
  },
): IntegrationExecutionContext<TConfig> {
  const logger = createMockIntegrationLogger();
  const accountId =
    process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID ||
    LOCAL_INTEGRATION_INSTANCE.accountId;

  // copy local instance properties so that tests cannot
  // mutate the original object and cause unpredicable behavior
  const instance = {
    ...LOCAL_INTEGRATION_INSTANCE,
    accountId,
  } as IntegrationInstance<TConfig>;

  if (isOptionsWithInstanceConfig<TConfig>(options)) {
    instance.config = options.instanceConfig;
  } else {
    const { instanceConfigFields } = options;
    try {
      instance.config = loadConfigFromEnvironmentVariables(
        instanceConfigFields,
      );
    } catch (err) {
      // failed to load configuration, not end of the world
      // because this is only used in testing
      //
      // For convenience, we will generate a config for the developer
      //
      // this would generally only happen when a developer does not
      // have an .env file configured or when an integration's test suite
      // runs in CI
      instance.config = generateInstanceConfig<TConfig>(instanceConfigFields);
    }
  }

  return {
    logger,
    instance,
  };
}

function isOptionsWithInstanceConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>(
  options: CreateMockExecutionContextOptions<TConfig>,
): options is CreateMockExecutionContextOptionsWithInstanceConfig<TConfig> {
  return !!(options as any).instanceConfig;
}

export type CreateMockStepExecutionContextOptions<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = CreateMockExecutionContextOptions<TConfig> & CreateMockJobStateOptions;

export interface MockIntegrationStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> extends IntegrationStepExecutionContext<TConfig> {
  jobState: MockJobState;
}

export function createMockStepExecutionContext<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>(
  options: CreateMockStepExecutionContextOptions<TConfig> = {
    instanceConfigFields: {},
  },
): MockIntegrationStepExecutionContext<TConfig> {
  return {
    ...createMockExecutionContext<TConfig>(options),
    jobState: createMockJobState(options),
  };
}

function generateInstanceConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
>(configFields: IntegrationInstanceConfigFieldMap): TConfig {
  return Object.entries(configFields).reduce(
    (acc: IntegrationInstance['config'], [field, config]) => {
      acc[field] = getInstanceConfigValueFromType(config);
      return acc;
    },
    {},
  ) as TConfig;
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
