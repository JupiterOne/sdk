import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

const fetchAccountsStep: Step<StepExecutionContext> = {
  id: 'fetch-groups',
  name: 'Fetch Groups',
  entities: [],
  relationships: [
    {
      _type: 'the_root_has_my_account',
      _class: RelationshipClass.HAS,
      sourceType: 'the_root',
      targetType: 'my_account',
    },
  ],
  executionHandler: noop,
};

export default fetchAccountsStep;
