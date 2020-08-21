import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';

const fetchAccountsStep: Step<StepExecutionContext> = {
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
};

export default fetchAccountsStep;
