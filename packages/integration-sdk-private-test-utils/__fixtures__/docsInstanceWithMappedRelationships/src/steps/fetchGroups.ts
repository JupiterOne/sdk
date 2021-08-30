import noop from 'lodash/noop';
import {
  StepExecutionContext,
  Step,
  RelationshipDirection,
} from '@jupiterone/integration-sdk-core';
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
  ],
  relationships: [],
  mappedRelationships: [
    {
      _type: 'my_group_has_user',
      sourceType: 'my_group',
      _class: RelationshipClass.HAS,
      targetType: 'your_user', // this is the target ("placeholder") entity
      direction: RelationshipDirection.FORWARD,
    },
  ],
  executionHandler: noop,
};

export default fetchGroupsStep;
