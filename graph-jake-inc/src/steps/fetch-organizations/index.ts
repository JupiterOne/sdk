import {
  IntegrationStep,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../../config';
import { Steps, Entities, Relationships } from '../constants';
import { createAPIClient } from '../../client';
import { createOrganizationEntity } from '../converters';

export const organizationSteps: IntegrationStep<IntegrationConfig>[] = [
  {
    id: Steps.FETCH_ORGANIZATIONS,
    name: 'Fetch Organizations',
    entities: [Entities.ORGANIZATION],
    relationships: [],
    dependsOn: [],
    executionHandler: fetchOrganizations,
  },
  {
    id: Steps.BUILD_ORGANIZATION_USER_RELATIONSHIPS,
    name: 'Build Organization User Relationships',
    entities: [],
    relationships: [Relationships.ORGANIZATION_HAS_USER],
    dependsOn: [Steps.FETCH_ORGANIZATIONS, Steps.FETCH_USERS],
    executionHandler: buildOrganizationHasUserRelationships,
  },
];

export async function fetchOrganizations({
  instance,
  jobState,
  executionConfig,
}: IntegrationStepExecutionContext<IntegrationConfig>): Promise<void> {
  const client = createAPIClient(instance.config);

  await client.iterateOrganizations('/corps', async (data) => {
    await jobState.addEntity(createOrganizationEntity(data));
  });
}
