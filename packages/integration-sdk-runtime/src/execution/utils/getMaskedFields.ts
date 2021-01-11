import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';
import { keys, pickBy } from 'lodash';

export function getMaskedFields(config: IntegrationInvocationConfig) {
  return keys(pickBy(config.instanceConfigFields, (val) => val.mask));
}
