import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

const fetchAccountsStep: Step<StepExecutionContext> = {
  id: 'fetch-accounts',
  name: 'Fetch Accounts',
  entities: [
    {
      resourceName: 'The Root',
      _type: 'the_root',
      _class: 'Root',
    },
    {
      resourceName: 'Account',
      _type: 'my_account',
      _class: 'Account',
    },
    {
      resourceName: 'Account 1',
      _type: 'my_account_1',
      _class: 'Account',
    },

    {
      resourceName: 'Account 2',
      _type: 'my_account_2',
      _class: 'Account',
    },
  ],
  relationships: [
    {
      _type: 'the_root_has_my_account_2',
      _class: RelationshipClass.HAS,
      sourceType: 'the_root',
      targetType: 'my_account_2',
    },
    {
      _type: 'the_root_has_my_account',
      _class: RelationshipClass.HAS,
      sourceType: 'the_root',
      targetType: 'my_account',
    },
    {
      _type: 'the_root_has_my_account_1',
      _class: RelationshipClass.HAS,
      sourceType: 'the_root',
      targetType: 'my_account_1',
    },
  ],
  executionHandler: noop,
};

export default fetchAccountsStep;
