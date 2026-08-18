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
  delete process.env.CA_CERTIFICATE;
  delete process.env.DISABLE_TLS_VERIFICATION;

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

test('loads CA_CERTIFICATE and DISABLE_TLS_VERIFICATION even when not declared in instanceConfigFields', () => {
  process.env.CA_CERTIFICATE =
    '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----';
  process.env.DISABLE_TLS_VERIFICATION = 'true';

  const config = loadConfigFromEnvironmentVariables({});

  expect(config).toEqual({
    caCertificate:
      '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
    disableTlsVerification: true,
  });
});

test('treats CA_CERTIFICATE and DISABLE_TLS_VERIFICATION as optional when env is not set', () => {
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'stringVariable', IntegrationInstanceConfigField>
  > = {
    stringVariable: {
      type: 'string',
    },
  };

  const config = loadConfigFromEnvironmentVariables(instanceConfigFields);

  expect(config).toEqual({
    stringVariable: 'string',
  });
});

test('respects integration-declared caCertificate / disableTlsVerification over implicit defaults', () => {
  process.env.CA_CERTIFICATE = 'cert-value';
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'caCertificate', IntegrationInstanceConfigField>
  > = {
    caCertificate: {
      type: 'string',
    },
  };

  const config = loadConfigFromEnvironmentVariables(instanceConfigFields);

  expect(config).toEqual({ caCertificate: 'cert-value' });
});

test('a declared caCertificate replaces the implicit one, so it is no longer optional', () => {
  // The implicit definition is optional, so an unset CA_CERTIFICATE would
  // resolve to undefined. Declaring the field without `optional` has to win,
  // which is only observable when the environment variable is missing.
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'caCertificate', IntegrationInstanceConfigField>
  > = {
    caCertificate: {
      type: 'string',
    },
  };

  expect(() =>
    loadConfigFromEnvironmentVariables(instanceConfigFields),
  ).toThrow(
    'Expected environment variable "CA_CERTIFICATE" for config field "caCertificate" to be set.',
  );
});

test('treats a blank implicit agent-configuration variable as unset', () => {
  // The platform writes these for every integration, none of which declared
  // them. A blank value must not fail the boolean conversion and abort the run.
  process.env.CA_CERTIFICATE = '';
  process.env.DISABLE_TLS_VERIFICATION = '';

  const config = loadConfigFromEnvironmentVariables({});

  expect(config).toEqual({});
});

test('treats a whitespace-only implicit agent-configuration variable as unset', () => {
  process.env.CA_CERTIFICATE = '  ';
  process.env.DISABLE_TLS_VERIFICATION = ' ';

  const config = loadConfigFromEnvironmentVariables({});

  expect(config).toEqual({});
});

test('still rejects a blank value for an agent-configuration field the integration declared', () => {
  // Once the integration declares the field it owns it, and a value the
  // integration cannot parse stays an error rather than being ignored.
  process.env.DISABLE_TLS_VERIFICATION = '';
  const instanceConfigFields: IntegrationInstanceConfigFieldMap<
    Record<'disableTlsVerification', IntegrationInstanceConfigField>
  > = {
    disableTlsVerification: {
      type: 'boolean',
      optional: true,
    },
  };

  expect(() =>
    loadConfigFromEnvironmentVariables(instanceConfigFields),
  ).toThrow(
    'Expected boolean value for field "disableTlsVerification" but received "".',
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
