import {
  createDirectRelationship,
  IntegrationStep,
  IntegrationStepExecutionContext,
  RelationshipClass,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../../config';
import { Steps, Entities } from '../constants';
import { createAPIClient } from '../../client';
import { createFirewallEntity } from '../converters';

export const firewallSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_FIREWALLS,
    name: 'Fetch Firewalls',
    entities: [Entities.FIREWALL],
    relationships: [],
    dependsOn: ['fetch-organizations'],
    executionHandler: fetchFirewalls,
  },
];

export async function fetchFirewalls({
  instance,
  jobState,
  executionConfig,
}: IntegrationStepExecutionContext<IntegrationConfig>): Promise<void> {
  const client = createAPIClient(instance.config, executionConfig);

  await jobState.iterateEntities(
    { _type: 'signal_sciences_organization' },
    async (parentEntity) => {
      const path = `${parentEntity['_key']}/${parentEntity['_otherKey']}`;
      await client.iterateFirewall(path, async (data) => {
        const entity = await jobState.addEntity(createFirewallEntity(data));

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
