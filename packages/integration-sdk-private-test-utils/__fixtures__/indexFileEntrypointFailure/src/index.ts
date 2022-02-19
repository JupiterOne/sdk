import noop from 'lodash/noop';
import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';

import {
  IntegrationInstanceConfig,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

export type IntegrationStepContext =
  IntegrationStepExecutionContext<IntegrationConfig>;

export interface IntegrationConfig extends IntegrationInstanceConfig {
  myConfig: boolean;
}

export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> =
  {
    instanceConfigFields: {
      myConfig: {
        mask: true,
        type: 'boolean',
      },
    },
    integrationSteps: [
      {
        id: 'fetch-accounts',
        name: 'Fetch Accounts',
        entities: [
          {
            resourceName: 'The Account',
            _type: 'my_account',
            _class: 'Account',
          },
        ],
        relationships: [],
        executionHandler: noop,
      },
      {
        id: 'fetch-users',
        name: 'Fetch Users',
        entities: [
          {
            resourceName: 'The User',
            _type: 'my_user',
            _class: 'User',
          },
        ],
        relationships: [],
        executionHandler: noop,
      },
    ],
    validateInvocation: noop,
    getStepStartStates: () => ({
      'fetch-accounts': {
        disabled: false,
      },
      'fetch-users': {
        disabled: false,
      },
    }),
  };

export default invocationConfig;
