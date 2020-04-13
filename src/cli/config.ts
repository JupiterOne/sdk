/**
 * Load ts-node register for picking up typescript files
 */
require('ts-node/register/transpile-only');

import path from 'path';
import { promises as fs } from 'fs';

import * as log from './log';

import {
  // IntegrationInvocationConfig,
  IntegrationInstanceConfigFieldMap,
  InvocationValidationFunction,
  GetStepStartStatesFunction,
  // IntegrationStep,
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
export async function loadConfig(): Promise<any> {
  log.debug('Loading integration configuration...\n');

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
  log.debug('Loading instanceConfigFields...');
  return loadModuleContent<IntegrationInstanceConfigFieldMap>(
    path.join('src', 'instanceConfigFields'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadValidateInvocationFunction() {
  log.debug('Loading validateInvocation function...');
  return loadModuleContent<InvocationValidationFunction>(
    path.join('src', 'validateInvocation'),
  );
}

/**
 * Loads getStepStartStates function from ./src/getStepStartStates.(t|j)s
 */
export function loadGetStepStartStatesFunction() {
  log.debug('Loading getStepStartStates function...');
  return loadModuleContent<GetStepStartStatesFunction>(
    path.join('src', 'getStepStartStates'),
  );
}

export async function loadIntegrationSteps() {
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
