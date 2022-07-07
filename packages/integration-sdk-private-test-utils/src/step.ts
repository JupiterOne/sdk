import { IntegrationStep } from '@jupiterone/integration-sdk-core';

function getMockIntegrationStep(
  config?: Partial<IntegrationStep>,
): IntegrationStep {
  return {
    id: 'id',
    name: 'name',
    entities: [],
    relationships: [],
    executionHandler: () => undefined,
    ...config,
  };
}

export { getMockIntegrationStep };
