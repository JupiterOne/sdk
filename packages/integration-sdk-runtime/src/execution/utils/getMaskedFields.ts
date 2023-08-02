import {
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';
import { keys, pickBy } from 'lodash';

export function getMaskedFields<
  TIntegrationConfig extends
    IntegrationInstanceConfig = IntegrationInstanceConfig,
>(config: IntegrationInvocationConfig<TIntegrationConfig>) {
  return keys(pickBy(config.instanceConfigFields, (val) => val.mask));
}
