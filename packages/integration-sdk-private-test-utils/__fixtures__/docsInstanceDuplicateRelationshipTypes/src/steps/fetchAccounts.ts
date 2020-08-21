import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';

const fetchAccountsStep: Step<StepExecutionContext> = {
  id: 'fetch-accounts',
  name: 'Fetch Accounts',
  entities: [],
  relationships: [
    {
      _type: 'the_root_has_my_account',
      _class: 'HAS',
      sourceType: 'the_root',
      targetType: 'my_account',
    },
  ],
  executionHandler: noop,
};

export default fetchAccountsStep;
