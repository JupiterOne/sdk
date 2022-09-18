import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';
import {
  CustomExecutionConfig,
  CustomInstanceConfig,
  loadExecutionConfig,
  validateInvocation,
} from './config';
import step from './steps';

export const invocationConfig: IntegrationInvocationConfig<
  CustomInstanceConfig,
  CustomExecutionConfig
> = {
  instanceConfigFields: {
    myInstanceConfigField: {
      mask: true,
      type: 'string',
    },
  },
  integrationSteps: [step],
  validateInvocation,
  loadExecutionConfig,
};
