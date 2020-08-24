import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

const fetchGroupsStep: Step<StepExecutionContext> = {
  id: 'fetch-groups',
  name: 'Fetch Groups',
  entities: [
    {
      resourceName: 'The Group',
      _type: 'my_group',
      _class: 'Group',
    },
    {
      resourceName: 'The User',
      _type: 'my_user',
      _class: 'User',
    },
  ],
  relationships: [
    {
      _class: RelationshipClass.HAS,
      _type: 'my_group_has_user',
      sourceType: 'my_group',
      targetType: 'my_user',
    },
  ],
  executionHandler: noop,
};

export default fetchGroupsStep;
