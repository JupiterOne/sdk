import {
  IntegrationExecutionConfig,
  IntegrationExecutionContext,
  IntegrationInstanceConfig,
  IntegrationStepExecutionContext,
} from '@jupiterone/integration-sdk-core';

export interface CustomInstanceConfig extends IntegrationInstanceConfig {
  myInstanceConfigField: string;
}

export interface CustomExecutionConfig extends IntegrationExecutionConfig {
  myExecutionConfigField: string;
}

export type CustomExecutionContext = IntegrationExecutionContext<
  CustomInstanceConfig,
  CustomExecutionConfig
>;

export interface CustomStepExecutionContext
  extends IntegrationStepExecutionContext<
    CustomInstanceConfig,
    CustomExecutionConfig
  > {
  myStepExecutionContextField: string;
}

export function validateInvocation(context: CustomExecutionContext) {
  if (
    context.instance.config.myInstanceConfigField !==
    'myInstanceConfigFieldValue'
  )
    throw new Error('Invalid instance config');
}

export function loadExecutionConfig(options: {
  config: CustomInstanceConfig;
}): CustomExecutionConfig {
  if (options.config.myInstanceConfigField !== 'myInstanceConfigFieldValue')
    throw new Error('Invalid instance config');
  return {
    myExecutionConfigField: 'myExecutionConfigFieldValue',
  };
}
