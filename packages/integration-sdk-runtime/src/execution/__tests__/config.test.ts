import path from 'path';

import { vol } from 'memfs';

import { loadConfigFromEnvironmentVariables } from '../config';
import {
  IntegrationInstanceConfigFieldMap,
  IntegrationInstanceConfigField,
} from '@jupiterone/integration-sdk-core';

jest.mock('fs');

beforeEach(() => {
  process.env.STRING_VARIABLE = 'string';
  process.env.BOOLEAN_VARIABLE = 'true';
  process.env.STRING_ARRAY_VARIABLE = '["string1", "string2"]';
});

afterEach(() => {
  delete process.env.STRING_VARIABLE;
  delete process.env.BOOLEAN_VARIABLE;
  delete process.env.STRING_ARRAY_VARIABLE;

  vol.reset();
});

test('loads config fields from environment variables', () => {
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<
      'stringVariable' | 'booleanVariable' | 'stringArrayVariable',
      IntegrationInstanceConfigField
    >
  > = {
    stringVariable: {
      type: 'string',
    },
    booleanVariable: {
      type: 'boolean',
    },
    stringArrayVariable: {
      type: 'json',
    },
  };

  const config = loadConfigFromEnvironmentVariables(instanceConfigFields);

  expect(config).toEqual({
    stringVariable: 'string',
    booleanVariable: true,
    stringArrayVariable: ['string1', 'string2'],
  });
});

test('throws error if expected environment is not set for config field', () => {
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'mySuperAwesomeEnvironmentVariable', IntegrationInstanceConfigField>
  > = {
    mySuperAwesomeEnvironmentVariable: {
      type: 'string',
    },
  };

  expect(() =>
    loadConfigFromEnvironmentVariables(instanceConfigFields),
  ).toThrow(
    'Expected environment variable "MY_SUPER_AWESOME_ENVIRONMENT_VARIABLE" for config field "mySuperAwesomeEnvironmentVariable" to be set.',
  );
});

test('does not throws error if optional environment is not set for config field', () => {
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<
      'mySuperAwesomeEnvironmentVariable' | 'booleanVariable',
      IntegrationInstanceConfigField
    >
  > = {
    mySuperAwesomeEnvironmentVariable: {
      type: 'string',
      optional: true,
    },
    booleanVariable: {
      type: 'boolean',
      optional: true,
    },
  };

  const config = loadConfigFromEnvironmentVariables(instanceConfigFields);

  expect(config).toEqual({
    booleanVariable: true,
  });
});

test('throws error if expected environment boolean field does not match "true" or "false"', () => {
  process.env.BOOLEAN_VARIABLE = 'mochi';
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'booleanVariable', IntegrationInstanceConfigField>
  > = {
    booleanVariable: {
      type: 'boolean',
    },
  };

  expect(() =>
    loadConfigFromEnvironmentVariables(instanceConfigFields),
  ).toThrow(
    'Expected boolean value for field "booleanVariable" but received "mochi".',
  );
});

test('loads environment variables from .env', () => {
  vol.fromJSON({
    [path.join(process.cwd(), '.env')]: 'MY_ENV_VAR=mochi',
  });

  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'myEnvVar', IntegrationInstanceConfigField>
  > = {
    myEnvVar: {
      type: 'string',
    },
  };

  const config = loadConfigFromEnvironmentVariables(instanceConfigFields);
  expect(config).toEqual({
    myEnvVar: 'mochi',
  });
});
