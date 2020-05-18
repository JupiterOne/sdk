import chalk from 'chalk';
import xor from 'lodash/xor';

import {
  ExecuteIntegrationResult,
  IntegrationStepResult,
  IntegrationStepResultStatus,
} from './framework/execution';
import { SynchronizationJob } from './framework/synchronization';

export function debug(msg: string) {
  console.log(`${chalk.gray(msg)}`);
}

export function info(msg: string) {
  console.log(`${chalk.white(msg)}`);
}

export function warn(msg: string) {
  console.log(`${chalk.yellow(msg)}`);
}

export function displaySynchronizationResults(job: SynchronizationJob) {
  info('\nSynchronization results:\n');
  info(`Synchronization job status: ${chalk.cyan(job.status)}`);
  info(`Entities uploaded: ${chalk.cyan(job.numEntitiesUploaded)}`);
  info(`Relationships uploaded: ${chalk.cyan(job.numRelationshipsUploaded)}`);
}

export function displayExecutionResults(results: ExecuteIntegrationResult) {
  info('\nResults:\n');

  let undeclaredTypesDetected: boolean = false;

  results.integrationStepResults.forEach((step) => {
    logStepStatus(step);

    if (step.status === IntegrationStepResultStatus.SUCCESS) {
      const { declaredTypes, encounteredTypes } = step;
      const diff = xor(declaredTypes, encounteredTypes);

      const declaredTypeSet = new Set(declaredTypes);
      const undeclaredTypes = diff.filter((type) => !declaredTypeSet.has(type));

      if (undeclaredTypes.length) {
        undeclaredTypesDetected = true;
      }

      logUndeclaredAndExtraneousTypes(declaredTypeSet, diff);
    }
  });

  if (undeclaredTypesDetected) {
    warn(
      `\nUndeclared types were detected!
To ensure that integration failures do not cause accidental data loss,
please ensure that all known entity and relationship types
collected by a step are declared in the step's "types" field.`,
    );
  }

  const { partialDatasets } = results.metadata;

  if (partialDatasets.types.length) {
    warn('\nThe following datasets were marked as partial:');
    info(partialDatasets.types.map((type) => `  - ${type}`).join('\n'));
  }
}

function logStepStatus(stepResult: IntegrationStepResult) {
  const stepPrefix = chalk.white(
    `Step "${chalk.cyan(stepResult.id)}" completed with status:`,
  );
  const statusText = getStepStatusText(stepResult.status);
  console.log(`${stepPrefix} ${statusText}`);
}

function getStepStatusText(status: IntegrationStepResultStatus) {
  switch (status) {
    case IntegrationStepResultStatus.SUCCESS:
      return chalk.green(status);
    case IntegrationStepResultStatus.FAILURE:
      return chalk.red(status);
    case IntegrationStepResultStatus.PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE:
      return chalk.yellow(status);
    case IntegrationStepResultStatus.DISABLED:
      return chalk.gray(status);
  }
}

function logUndeclaredAndExtraneousTypes(
  declaredTypeSet: Set<string>,
  diff: string[],
) {
  const undeclaredTypes: string[] = [];

  diff.forEach((type) => {
    if (!declaredTypeSet.has(type)) {
      undeclaredTypes.push(type);
    }
  });

  if (undeclaredTypes.length) {
    const undeclaredTypesList = undeclaredTypes.map((type) => {
      return `\n  - ${type}`;
    });
    warn(
      `The following types were encountered but are not declared in the step's "types" field:${undeclaredTypesList}`,
    );

    console.log('');
  }
}
