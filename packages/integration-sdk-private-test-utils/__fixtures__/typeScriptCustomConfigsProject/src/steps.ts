import {
  createIntegrationEntity,
  IntegrationStep,
} from '@jupiterone/integration-sdk-core';
import {
  CustomExecutionConfig,
  CustomInstanceConfig,
  CustomStepExecutionContext,
} from './config';

const stepId = 'step-id';
const stepName = 'Step Name';
const entities = [
  {
    resourceName: 'The Account',
    _type: 'my_account',
    _class: 'Account',
  },
];
const relationships = [];

const step: IntegrationStep<CustomInstanceConfig, CustomExecutionConfig> = {
  id: stepId,
  name: stepName,
  entities,
  relationships,

  executionHandler: async (context: CustomStepExecutionContext) => {
    const { instance, jobState, executionConfig, stepMetadata } = context;

    if (
      context.myStepExecutionContextField != 'myStepExecutionContextFieldValue'
    )
      throw new Error('Invalid step execution context');

    if (
      executionConfig.myExecutionConfigField !== 'myExecutionConfigFieldValue'
    )
      throw new Error('Invalid execution config');

    if (instance.config.myInstanceConfigField !== 'myInstanceConfigFieldValue')
      throw new Error('Invalid instance config');

    if (stepMetadata.id != stepId) throw new Error('Invalid step metadata');
    if (stepMetadata.name != stepName) throw new Error('Invalid step metadata');
    if (stepMetadata.entities != entities)
      throw new Error('Invalid step metadata');
    if (stepMetadata.relationships != relationships)
      throw new Error('Invalid step metadata');

    await jobState.addEntities([
      createIntegrationEntity({
        entityData: {
          source: {
            id: '1234',
            name: instance.config.myInstanceConfigField,
            description: executionConfig.myExecutionConfigField,
          },
          assign: {
            _key: 'account:1234',
            _type: 'my_account',
            _class: 'Account',
          },
        },
      }),
    ]);
  },
};

export default step;
