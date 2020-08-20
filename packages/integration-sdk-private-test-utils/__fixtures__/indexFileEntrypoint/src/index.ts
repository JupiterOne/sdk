import noop from 'lodash/noop';

export const invocationConfig = {
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
          _class: 'User',
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
          resourceName: 'The user',
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
