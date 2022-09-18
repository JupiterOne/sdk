import {
  createDirectRelationship,
  createIntegrationEntity,
  IntegrationStepExecutionContext,
  Step,
  StepExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { RelationshipClass } from '@jupiterone/data-model';

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
  relationships: [
    {
      _class: RelationshipClass.HAS,
      _type: 'my_account_has_user',
      sourceType: 'my_account',
      targetType: 'my_user',
    },
  ],
  executionHandler: async ({ jobState }: IntegrationStepExecutionContext) => {
    await jobState.addEntities([
      createIntegrationEntity({
        entityData: {
          source: {
            id: '12345',
            name: 'User 12345',
            description: 'User 12345',
            username: 'foo@email.com',
          },
          assign: {
            _key: 'user:12345',
            _type: 'my_user',
            _class: 'User',
            active: false,
          },
        },
      }),
    ]);
    await jobState.addRelationships([
      createDirectRelationship({
        _class: RelationshipClass.HAS,
        fromKey: 'account:1234',
        fromType: 'my_account',
        toKey: 'user:12345',
        toType: 'my_user',
      }),
    ]);
  },
};

export default fetchUsersStep;
