import {
  StepExecutionContext,
  Step,
  createIntegrationEntity,
} from '@jupiterone/integration-sdk-core';

function createEntityThatFailsDataModelValidation() {
  return createIntegrationEntity({
    entityData: {
      source: {},
      assign: {
        _class: 'User',
        _type: 'my_user',
        _key: 'user-id-123456789',
        name: undefined,
        displayName: undefined,
        username: undefined,
      },
    },
  });
}

const fetchUsersStep: Step<StepExecutionContext> = {
  id: 'fetch-users',
  name: 'Fetch Users',
  entities: [
    {
      resourceName: 'The User',
      _type: 'my_user',
      _class: 'User',
    },
  ],
  relationships: [],
  executionHandler: async (context: StepExecutionContext) => {
    await context.jobState.addEntity(
      createEntityThatFailsDataModelValidation(),
    );
  },
};

export default fetchUsersStep;
