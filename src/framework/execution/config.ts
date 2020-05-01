import dotenv from 'dotenv';
import snakeCase from 'lodash/snakeCase';

import {
  IntegrationInstanceConfigField,
  IntegrationInstanceConfigFieldMap,
} from './types';

import {
  IntegrationLocalConfigFieldMissingError,
  IntegrationLocalConfigFieldTypeMismatch,
} from './error';

const dotenvExpand = require('dotenv-expand');

/**
 * Reads integration configuration from environment variables
 */
export function loadConfigFromEnvironmentVariables(
  configMap: IntegrationInstanceConfigFieldMap,
): Record<string, string | boolean> {
  // pull in environment variables from .env file if available
  dotenvExpand(dotenv.config());

  return Object.entries(configMap)
    .map(([field, config]): [string, string | boolean] => {
      const environmentVariableName = snakeCase(field).toUpperCase();

      const environmentVariableValue = process.env[environmentVariableName];

      if (environmentVariableValue === undefined) {
        throw configFieldMissingError(field, environmentVariableName);
      }
      const convertedValue = convertEnvironmentVariableValueForField(
        field,
        config,
        environmentVariableValue,
      );

      return [field, convertedValue];
    })
    .reduce((acc: Record<string, string | boolean>, [field, value]) => {
      acc[field] = value;
      return acc;
    }, {});
}

function convertEnvironmentVariableValueForField(
  field: string,
  fieldConfig: IntegrationInstanceConfigField,
  environmentVariableValue: string,
): string | boolean {
  let convertedValue: string | boolean;

  switch (fieldConfig.type) {
    case 'boolean': {
      const rawString = environmentVariableValue.toLowerCase();
      if (rawString === 'true') {
        convertedValue = true;
      } else if (rawString === 'false') {
        convertedValue = false;
      } else {
        throw typeMismatchError(field, environmentVariableValue);
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

function typeMismatchError(field: string, value: string) {
  throw new IntegrationLocalConfigFieldTypeMismatch(
    `Expected boolean value for field "${field}" but received "${value}".`,
  );
}
