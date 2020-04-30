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
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
): Promise<IntegrationInvocationConfig> {
  if (await isTypescriptPresent(projectSourceDirectory)) {
    log.debug('TypeScript files detected. Registering ts-node.');
    registerTypescript();
  }

  const config = {
    instanceConfigFields: loadInstanceConfigFields(projectSourceDirectory),
    validateInvocation: loadValidateInvocationFunction(projectSourceDirectory),
    getStepStartStates: loadGetStepStartStatesFunction(projectSourceDirectory),
    integrationSteps: await loadIntegrationSteps(projectSourceDirectory),
  };

  return config;
}

/**
 * Loads instanceConfigFields from ./src/instanceConfigFields
 */
export function loadInstanceConfigFields(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
) {
  return loadModuleContent<IntegrationInstanceConfigFieldMap>(
    path.resolve(projectSourceDirectory, 'instanceConfigFields'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadValidateInvocationFunction(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
) {
  return loadModuleContent<InvocationValidationFunction>(
    path.resolve(projectSourceDirectory, 'validateInvocation'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadGetStepStartStatesFunction(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
) {
  return loadModuleContent<GetStepStartStatesFunction>(
    path.resolve(projectSourceDirectory, 'getStepStartStates'),
  );
}

export async function loadIntegrationSteps(
  projectSourceDirectory: string = path.join(process.cwd(), 'src'),
): Promise<IntegrationStep[]> {
  let files: string[];

  const stepsDir = path.resolve(projectSourceDirectory, 'steps');

  try {
    files = await fs.readdir(stepsDir);
  } catch (err) {
    console.error(err);
    return [];
  }

  const steps: IntegrationStep[] = [];
  for (const file of files) {
    const step = loadModuleContent<IntegrationStep>(
      path.resolve(stepsDir, file),
    );
    if (step !== undefined) {
      steps.push(step);
    }
  }

  return steps;
}

export function loadModuleContent<T>(modulePath: string): T | undefined {
  let integrationModule: any;

  try {
    integrationModule = require(modulePath);
  } catch (err) {
    // module not found
    return undefined;
  }

  return integrationModule?.default ?? integrationModule;
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
  const paths = await globby('**/*.ts', {
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
