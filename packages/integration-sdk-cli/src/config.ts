import globby from 'globby';
import path from 'path';

import {
  IntegrationError,
  IntegrationInvocationConfig,
} from '@jupiterone/integration-sdk-core';

import * as log from './log';

export class IntegrationInvocationConfigLoadError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'INVOCATION_CONFIG_LOAD_ERROR',
      message,
    });
  }
}

/**
 * Loads integration invocation configuration.
 */
export async function loadConfig(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
): Promise<IntegrationInvocationConfig> {
  if (await isTypescriptPresent(projectSourceDirectory)) {
    log.debug('TypeScript files detected. Registering ts-node.');
    registerTypescript();
  }

  return loadInvocationConfig(projectSourceDirectory);
}

/**
 * Loads instanceConfigFields from ./src/instanceConfigFields
 */
export function loadInvocationConfig(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
): IntegrationInvocationConfig {
  let integrationModule: any;

  try {
    integrationModule = require(path.resolve(projectSourceDirectory, 'index'));
  } catch (err) {
    throw new IntegrationInvocationConfigLoadError(
      'Error loading integration invocation configuration. Ensure "invocationConfig" is exported from "src/index". Additional details: ' +
        err,
    );
  }

  return integrationModule.invocationConfig as IntegrationInvocationConfig;
}

function loadConfigFromSrc(projectPath: string) {
  return loadConfig(path.join(projectPath, 'src'));
}

function loadConfigFromDist(projectPath: string) {
  return loadConfig(path.join(projectPath, 'dist'));
}

/**
 * The way that integration npm packages are distributed has changed over time.
 * This function handles different cases where the invocation config has
 * traditionally lived to support backwards compatibility and make adoption
 * easier.
 */
export async function loadConfigFromTarget(projectPath: string) {
  let configFromSrcErr: Error | undefined;
  let configFromDistErr: Error | undefined;

  try {
    const configFromSrc = await loadConfigFromSrc(projectPath);
    return configFromSrc;
  } catch (err) {
    configFromSrcErr = err;
  }

  try {
    const configFromDist = await loadConfigFromDist(projectPath);
    return configFromDist;
  } catch (err) {
    configFromDistErr = err;
  }

  const combinedError = configFromDistErr
    ? configFromSrcErr + ', ' + configFromDistErr
    : configFromSrcErr;

  throw new IntegrationInvocationConfigLoadError(
    'Error loading integration invocation configuration. Ensure "invocationConfig" is exported from src/index or dist/index. Additional details: ' +
      combinedError,
  );
}

async function isTypescriptPresent(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
) {
  // NOTE: this does not use path.join because globby
  // (which uses fast-glob, which uses micromatch)
  // requires that forward slashes are used.
  //
  // Refs:
  // - https://github.com/mrmlnc/fast-glob#pattern-syntax
  // - https://github.com/micromatch/micromatch#backslashes
  const paths = await globby(['**/*.ts', '!**/*.d.ts'], {
    cwd: projectSourceDirectory,
  });
  return paths.length > 0;
}

/**
 * Load ts-node register for picking up typescript files
 */
function registerTypescript() {
  try {
    require('ts-node/register/transpile-only');
  } catch (err) {
    log.warn(
      'Looks like you are developing with TypeScript. Please make sure you have both typescript and ts-node installed. To allow the SDK to work with your code.',
    );
  }
}
