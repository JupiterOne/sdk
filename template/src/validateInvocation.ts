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

  context.logger.info('Integration instance is valid!');
}
