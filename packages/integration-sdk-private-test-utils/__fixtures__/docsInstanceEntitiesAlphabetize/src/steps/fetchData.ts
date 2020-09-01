import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';

const fetchDataSteps: Step<StepExecutionContext> = {
  id: 'fetch-data',
  name: 'Fetch Data',
  entities: [
    {
      resourceName: 'The User 2',
      _type: 'my_user_2',
      _class: 'User',
    },
    {
      resourceName: 'The Group',
      _type: 'my_group',
      _class: 'Group',
    },
    {
      resourceName: 'The Group 2',
      _type: 'my_group_2',
      _class: 'Group',
    },
    {
      resourceName: 'The User',
      _type: 'my_user',
      _class: 'User',
    },
  ],
  relationships: [],
  executionHandler: noop,
};

export default fetchDataSteps;
