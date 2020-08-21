import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';

const fetchGroupsStep: Step<StepExecutionContext> = {
  id: 'fetch-accounts',
  name: 'Fetch Accounts',
  entities: [
    {
      resourceName: 'The Group',
      _type: 'my_group',
      _class: 'Group',
    },
  ],
  relationships: [],
  executionHandler: noop,
};

export default fetchGroupsStep;
