import dotenv from 'dotenv';
import snakeCase from 'lodash/snakeCase';

import {
  IntegrationLocalConfigFieldMissingError,
  IntegrationLocalConfigFieldTypeMismatchError,
  IntegrationInstanceConfig,
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
} from '@jupiterone/integration-sdk-core';

const dotenvExpand = require('dotenv-expand');

/**
 * Global "agent configurations" that are exposed to every integration whose
 * `integrationPlatformFeatures.supportsAgentConfigurations` is enabled. They
 * are intentionally NOT required to be declared in `instanceConfigFields` so
 * that integrations can opt in without per-integration schema changes.
 *
 * The values are consumed by `BaseAPIClient.getDefaultAgent()` in
 * `@jupiterone/integration-sdk-http-client` and by the equivalent helper in
 * `@private/http-client` inside the integrations monorepo.
 */
const IMPLICIT_AGENT_CONFIG_FIELDS: IntegrationInstanceConfigFieldMap = {
  caCertificate: { type: 'string', optional: true },
  disableTlsVerification: { type: 'boolean', optional: true },
};

/**
 * Reads integration configuration from environment variables
 */
export function loadConfigFromEnvironmentVariables<
  TConfig extends IntegrationInstanceConfig,
>(configMap: IntegrationInstanceConfigFieldMap<TConfig>): TConfig {
  // pull in environment variables from .env file if available
  dotenvExpand(dotenv.config());

  // Merge implicit agent-configuration fields without overriding any
  // declarations the integration may have already made for the same key.
  const mergedConfigMap = {
    ...IMPLICIT_AGENT_CONFIG_FIELDS,
    ...configMap,
  } as IntegrationInstanceConfigFieldMap<TConfig>;

  return Object.entries(mergedConfigMap)
    .map(([field, config]): [string, string | object | boolean | undefined] => {
      const environmentVariableName = snakeCase(field).toUpperCase();

      const environmentVariableValue = process.env[environmentVariableName];

      if (environmentVariableValue === undefined) {
        if (config.optional) {
          return [field, undefined];
        } else {
          throw configFieldMissingError(field, environmentVariableName);
        }
      }
      const convertedValue = convertEnvironmentVariableValueForField(
        field,
        config,
        environmentVariableValue,
      );

      return [field, convertedValue];
    })
    .reduce(
      (acc: Record<string, string | object | boolean>, [field, value]) => {
        if (value !== undefined) {
          acc[field] = value;
        }
        return acc;
      },
      {},
    ) as TConfig;
}

function convertEnvironmentVariableValueForField(
  field: string,
  fieldConfig: IntegrationInstanceConfigField,
  environmentVariableValue: string,
): string | object | boolean {
  let convertedValue: string | object | boolean;

  switch (fieldConfig.type) {
    case 'boolean': {
      const rawString = environmentVariableValue.toLowerCase();
      if (rawString === 'true') {
        convertedValue = true;
      } else if (rawString === 'false') {
        convertedValue = false;
      } else {
        throw new IntegrationLocalConfigFieldTypeMismatchError(
          `Expected boolean value for field "${field}" but received "${environmentVariableValue}".`,
        );
      }
      break;
    }
    case 'json': {
      try {
        convertedValue = JSON.parse(environmentVariableValue);
      } catch (err) {
        throw new IntegrationLocalConfigFieldTypeMismatchError(
          `Local config field ${field} of type ${fieldConfig.type} is not valid JSON (value=${environmentVariableValue}, error=${err})`,
        );
      }
      break;
    }
    case 'string':
    default:
      convertedValue = environmentVariableValue;
  }
  return convertedValue;
}

function configFieldMissingError(
  field: string,
  environmentVariableName: string,
) {
  throw new IntegrationLocalConfigFieldMissingError(
    `Expected environment variable "${environmentVariableName}" for config field "${field}" to be set.`,
  );
}
