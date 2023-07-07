import {
  CredentialValidationContext,
  ExecutionContext,
  IntegrationExecutionContext,
} from './context';
import { IntegrationInstanceConfig } from './instance';

/**
 * This function is called before an integration starts collecting data.
 * It allows the integration to fail fast if credentials or other config
 * is incorrect.
 */
export type InvocationValidationFunction<T extends ExecutionContext> = (
  context: T,
) => Promise<void> | void;

export type IntegrationInvocationValidationFunction<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
> = InvocationValidationFunction<IntegrationExecutionContext<TConfig>>;

export type CredentialValidationResult = {
  /**
   * Declares of authentication was successful.
   * Does not determine if all permissions/scopes were correctly granted.
   */
  success: boolean;

  /**
   * Used to indicate if missing permissions/scopes were identified during validation.
   */
  missingPermissions?: Record<string, any>;
};

/**
 * The function is made available to the credential verification system
 * to test if credentials are valid prior to storing/using.
 */
export type CredentialValidationFunction = (
  context: CredentialValidationContext,
) => Promise<CredentialValidationResult> | void;
