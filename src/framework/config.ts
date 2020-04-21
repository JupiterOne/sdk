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
export async function loadConfig(): Promise<IntegrationInvocationConfig> {
  log.debug('Loading integration configuration...\n');

  if (await isTypescriptPresent()) {
    log.debug('TypeScript files detected. Registering ts-node.');
    registerTypescript();
  }

  const config = {
    instanceConfigFields: loadInstanceConfigFields(),
    validateInvocation: loadValidateInvocationFunction(),
    getStepStartStates: loadGetStepStartStatesFunction(),
    integrationSteps: await loadIntegrationSteps(),
  };

  return config;
}

/**
 * Loads instanceConfigFields from ./src/instanceConfigFields
 */
export function loadInstanceConfigFields() {
  return loadModuleContent<IntegrationInstanceConfigFieldMap>(
    path.join('src', 'instanceConfigFields'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadValidateInvocationFunction() {
  return loadModuleContent<InvocationValidationFunction>(
    path.join('src', 'validateInvocation'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadGetStepStartStatesFunction() {
  return loadModuleContent<GetStepStartStatesFunction>(
    path.join('src', 'getStepStartStates'),
  );
}

export async function loadIntegrationSteps(): Promise<IntegrationStep[]> {
  let files: string[] = [];

  const stepsDir = path.join(process.cwd(), 'src', 'steps');

  try {
    files = await fs.readdir(stepsDir);
  } catch (err) {
    console.error(err);
    // failed to read directory
  }

  return files.map((file) => {
    return loadModuleContent(path.join(stepsDir, file));
  });
}

export function loadModuleContent<T>(relativePath: string): T | undefined {
  let integrationModule: any;

  try {
    integrationModule = require(path.resolve(process.cwd(), relativePath));
  } catch (err) {
    // module not found
  }

  return integrationModule?.default ?? integrationModule;
}

async function isTypescriptPresent() {
  // NOTE: this does not use path.join because globby
  // (which uses fast-glob, which uses micromatch)
  // requires that forward slashes are used.
  //
  // Refs:
  // - https://github.com/mrmlnc/fast-glob#pattern-syntax
  // - https://github.com/micromatch/micromatch#backslashes
  const paths = await globby('src/**/*.ts');
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
