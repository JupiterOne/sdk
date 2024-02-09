import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../../config';
import { Steps, Entities } from '../constants';
import { createAPIClient } from '../../client';
import { createUserEntity } from '../converters';

export const userSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_USERS,
    name: 'Fetch Users',
    entities: [Entities.USER],
    relationships: [],
    dependsOn: ['fetch-organizations'],
    executionHandler: fetchUsers,
  },
];

export async function fetchUsers({
  instance,
  jobState,
  executionConfig,
}: IntegrationStepExecutionContext<IntegrationConfig>): Promise<void> {
  const client = createAPIClient(instance.config, executionConfig);

  await jobState.iterateEntities(
    { _type: 'signal_sciences_organization' },
    async (parentEntity) => {
      const path = `${parentEntity['_key']}`;
      await client.iterateUser(path, async (data) => {
        const entity = await jobState.addEntity(createUserEntity(data));

        await jobState.addRelationship(
          createDirectRelationship({
            from: parentEntity,
            _class: RelationshipClass.HAS,
            to: entity,
          }),
        );
      });
    },
  );
}
