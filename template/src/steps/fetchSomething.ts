import {
  IntegrationStep,
  IntegrationStepExecutionContext,
  createIntegrationEntity,
} from '@jupiterone/integration-sdk';

import { IntegrationConfig } from '../types';
import { createAPIClient } from '../client';

const step: IntegrationStep<IntegrationConfig> = {
  id: 'fetch-something',
  name: 'Fetch something',
  types: ['my_integration_something'],
  async executionHandler({
    instance,
    jobState,
  }: IntegrationStepExecutionContext<IntegrationConfig>) {
    const apiClient = createAPIClient(instance.config);

    await apiClient.iterateSomething(async (something) => {
      await jobState.addEntity([
        createIntegrationEntity({
          entityData: {
            source: something,
            assign: {
              _type: 'my-integration-something',
              _class: 'Record',
            },
          },
        }),
      ]);
    });
  },
};

export default step;
