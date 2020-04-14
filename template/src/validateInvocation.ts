import { IntegrationExecutionContext } from '@jupiterone/integration-sdk';

export default function validateInvocation(
  context: IntegrationExecutionContext,
) {
  context.logger.info(
    {
      instance: context.instance,
    },
    'Validating integration config...',
  );

  if (isConfigurationValid(context.instance.config)) {
    context.logger.info('Integration instance is valid!');
  } else {
    throw new Error('Failed to authenticate with provided credentials');
  }
}

function isConfigurationValid(config: any) {
  // add your own validation logic to ensure you
  // can hit the provider's apis.
  return config.clientId && config.clientSecret;
}
