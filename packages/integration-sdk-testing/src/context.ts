import {
  ExecutionHistory,
  IntegrationExecutionConfig,
  IntegrationExecutionContext,
  IntegrationInstance,
  IntegrationInstanceConfig,
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
  IntegrationStepExecutionContext,
  StepMetadata,
} from '@jupiterone/integration-sdk-core';
import {
  loadConfigFromEnvironmentVariables,
  LOCAL_INTEGRATION_INSTANCE,
} from '@jupiterone/integration-sdk-runtime';

import {
  createMockJobState,
  CreateMockJobStateOptions,
  MockJobState,
} from './jobState';
import { createMockIntegrationLogger } from './logger';

export type CreateMockExecutionContextOptions<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> =
  | CreateMockExecutionContextOptionsWithConfigs<
      TInstanceConfig,
      TExecutionConfig
    >
  | CreateMockExecutionContextOptionsWithInstanceConfigFields<
      TInstanceConfig,
      TExecutionConfig
    >;

interface CreateMockExecutionContextOptionsWithConfigs<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> {
  instanceConfig: TInstanceConfig;
  executionConfig: TExecutionConfig;
  executionHistory?: ExecutionHistory;
}

interface CreateMockExecutionContextOptionsWithInstanceConfigFields<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> {
  instanceConfigFields: IntegrationInstanceConfigFieldMap<TInstanceConfig>;
  executionHistory?: ExecutionHistory;
}

export function createMockExecutionContext<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
>(
  options: CreateMockExecutionContextOptions<
    TInstanceConfig,
    TExecutionConfig
  > = {
    instanceConfigFields:
      {} as IntegrationInstanceConfigFieldMap<TInstanceConfig>,
  },
): IntegrationExecutionContext<TInstanceConfig, TExecutionConfig> {
  const logger = createMockIntegrationLogger();
  const accountId =
    process.env.JUPITERONE_LOCAL_INTEGRATION_INSTANCE_ACCOUNT_ID ||
    LOCAL_INTEGRATION_INSTANCE.accountId;

  // copy local instance properties so that tests cannot
  // mutate the original object and cause unpredictable behavior
  const instance = {
    ...LOCAL_INTEGRATION_INSTANCE,
    accountId,
  } as IntegrationInstance<TInstanceConfig>;

  if (isOptionsWithInstanceConfig<TInstanceConfig>(options)) {
    instance.config = options.instanceConfig;
  } else {
    const { instanceConfigFields } = options;
    try {
      instance.config = loadConfigFromEnvironmentVariables(
        options.instanceConfigFields,
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
      instance.config =
        generateInstanceConfig<TInstanceConfig>(instanceConfigFields);
    }
  }

  return {
    logger,
    instance,
    executionConfig: {} as TExecutionConfig,
    executionHistory: options.executionHistory || {
      current: {
        startedOn: Date.now(),
      },
    },
  };
}

function isOptionsWithInstanceConfig<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
>(
  options: CreateMockExecutionContextOptions<TInstanceConfig>,
): options is CreateMockExecutionContextOptionsWithConfigs<TInstanceConfig> {
  return !!(options as any).instanceConfig;
}

export type CreateMockStepExecutionContextOptions<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> = CreateMockExecutionContextOptions<TInstanceConfig, TExecutionConfig> &
  CreateMockJobStateOptions & {
    stepMetadata: StepMetadata;
  };

export interface MockIntegrationStepExecutionContext<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> extends IntegrationStepExecutionContext<TInstanceConfig, TExecutionConfig> {
  jobState: MockJobState;
  stepMetadata: StepMetadata;
}

export function createMockStepExecutionContext<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
>(
  options: CreateMockStepExecutionContextOptions<
    TInstanceConfig,
    TExecutionConfig
  > = {
    instanceConfigFields:
      {} as IntegrationInstanceConfigFieldMap<TInstanceConfig>,
    stepMetadata: {} as StepMetadata,
  },
): MockIntegrationStepExecutionContext<TInstanceConfig, TExecutionConfig> {
  return {
    ...createMockExecutionContext<TInstanceConfig, TExecutionConfig>(options),
    stepMetadata: options.stepMetadata,
    jobState: createMockJobState(options),
  };
}

function generateInstanceConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
>(configFields: IntegrationInstanceConfigFieldMap<TConfig>): TConfig {
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
