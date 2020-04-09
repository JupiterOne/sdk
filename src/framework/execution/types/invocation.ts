import { IntegrationAction } from './action';

/**
 * An action delivered to an integration instance.
 *
 * Integrations are expected to process actions in a provider appropriate way,
 * depending on the `name` of the action and any additional, action-specific
 * properties.
 */
export interface IntegrationInvocationEvent {
  action: IntegrationAction;

  /**
   * The ID of the integration instance associated with the invocation.
   *
   * If this field is not populated, a fake local integration instance
   * will be provisioned.
   */
  integrationInstanceId?: string;
}
