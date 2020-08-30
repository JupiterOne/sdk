import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

const fetchAccountsStep: Step<StepExecutionContext> = {
  id: 'fetch-accounts',
  name: 'Fetch Accounts',
  entities: [],
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
