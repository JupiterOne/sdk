/**
 * A stored user configuration for executing the integration defined by
 * associated the `integrationDefinitionId`.
 */
export interface IntegrationInstance {
  /**
   * Unique identifier for the activated integration instance.
   */
  id: string;

  /**
   * `accountId` identifies the tenant/account holder that activated the
   * integration.
   */
  accountId: string;

  /**
   * A short friendly name for the integration instance that is provided by
   * end-user.
   */
  name: string;

  /**
   * Optional description of the integration instance.
   */
  description?: string;

  /**
   * The `integrationDefinitionId` identifies the integration definition
   * that the instance relates to.
   */
  integrationDefinitionId: string;

  /**
   * Each integration specifies the properties it requires a user provide when
   * configuring an instance of the integration. It is up to the UI to validate
   * input at configuration time, and the integration should also validate the
   * configuration upon invocation and provide useful configuration error
   * messages.
   */
  config: any;

  /**
   * Ternary marker for offsite flow state.
   *
   * Integrations supporting an offsite installation flow will set this value to
   * `false` when the instance is created, indicating that the configuration is
   * incomplete. The value will become `true` when the offsite flow has
   * completed successfully.
   *
   * Integrations that do/will not support an offsite installation flow will
   * leave this value `undefined`.
   */
  offsiteComplete?: boolean;
}
