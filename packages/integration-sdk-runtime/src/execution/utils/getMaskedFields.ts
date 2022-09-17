import {
  IntegrationExecutionConfig,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';
import { keys, pickBy } from 'lodash';

export function getMaskedFields<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
>(config: IntegrationInvocationConfig<TInstanceConfig, TExecutionConfig>) {
  return keys(pickBy(config.instanceConfigFields, (val) => val.mask));
}
