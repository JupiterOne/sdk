import path from 'path';
import { promises as fs } from 'fs';

import globby from 'globby';

import * as log from '../log';

import {
  IntegrationInvocationConfig,
  IntegrationInstanceConfigFieldMap,
  InvocationValidationFunction,
  GetStepStartStatesFunction,
  IntegrationStep,
} from '../framework/execution';

/**
 * Supports a convention over configuration approach
 * to building integrations.
 *
 * ./src/instanceConfigFields
 * ./src/steps/*
 * ./src/getStepStartStates
 * ./src/validateInvocation
 */
export async function loadConfig(
  projectDirectory: string = process.cwd(),
): Promise<IntegrationInvocationConfig> {
  log.debug('Loading integration configuration...\n');

  if (await isTypescriptPresent(projectDirectory)) {
    log.debug('TypeScript files detected. Registering ts-node.');
    registerTypescript();
  }

  const config = {
    instanceConfigFields: loadInstanceConfigFields(projectDirectory),
    validateInvocation: loadValidateInvocationFunction(projectDirectory),
    getStepStartStates: loadGetStepStartStatesFunction(projectDirectory),
    integrationSteps: await loadIntegrationSteps(projectDirectory),
  };

  return config;
}

/**
 * Loads instanceConfigFields from ./src/instanceConfigFields
 */
export function loadInstanceConfigFields(
  projectDirectory: string = process.cwd(),
) {
  return loadModuleContent<IntegrationInstanceConfigFieldMap>(
    path.resolve(projectDirectory, 'src', 'instanceConfigFields'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadValidateInvocationFunction(
  projectDirectory: string = process.cwd(),
) {
  return loadModuleContent<InvocationValidationFunction>(
    path.resolve(projectDirectory, 'src', 'validateInvocation'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadGetStepStartStatesFunction(
  projectDirectory: string = process.cwd(),
) {
  return loadModuleContent<GetStepStartStatesFunction>(
    path.resolve(projectDirectory, 'src', 'getStepStartStates'),
  );
}

export async function loadIntegrationSteps(
  projectDirectory: string = process.cwd(),
): Promise<IntegrationStep[]> {
  let files: string[] = [];

  const stepsDir = path.resolve(projectDirectory, 'src', 'steps');

  try {
    files = await fs.readdir(stepsDir);
  } catch (err) {
    console.error(err);
    // failed to read directory
  }

  return files.map((file) => {
    return loadModuleContent(path.resolve(stepsDir, file));
  });
}

export function loadModuleContent<T>(modulePath: string): T | undefined {
  let integrationModule: any;

  try {
    integrationModule = require(modulePath);
  } catch (err) {
    // module not found
  }

  return integrationModule?.default ?? integrationModule;
}

async function isTypescriptPresent(projectDirectory: string = process.cwd()) {
  // NOTE: this does not use path.join because globby
  // (which uses fast-glob, which uses micromatch)
  // requires that forward slashes are used.
  //
  // Refs:
  // - https://github.com/mrmlnc/fast-glob#pattern-syntax
  // - https://github.com/micromatch/micromatch#backslashes
  const paths = await globby('src/**/*.ts', {
    cwd: projectDirectory,
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
