import noop from 'lodash/noop';
import { StepExecutionContext, Step } from '@jupiterone/integration-sdk-core';

const fetchGroupsStep: Step<StepExecutionContext> = {
  id: 'fetch-groups',
  name: 'Fetch Groups',
  entities: [],
  relationships: [],
  executionHandler: noop,
};

export default fetchGroupsStep;
