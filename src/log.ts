import chalk from 'chalk';
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

export function displayExecutionResults(results: ExecuteIntegrationResult) {
  info('\nResults:\n');
  results.integrationStepResults.forEach((step) => {
    logStepStatus(step);
  });

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

export function displaySynchronizationResults(job: SynchronizationJob) {
  info('\nSynchronization results:\n');
  info(`Synchronization job status: ${chalk.cyan(job.status)}`);
  info(`Entities uploaded: ${chalk.cyan(job.numEntitiesUploaded)}`);
  info(`Relationships uploaded: ${chalk.cyan(job.numRelationshipsUploaded)}`);
}
