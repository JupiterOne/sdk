import {
  IntegrationIngestionConfigField,
  IntegrationIngestionConfigFieldMap,
  IntegrationSourceId,
  Step,
  StepExecutionContext,
} from '@jupiterone/integration-sdk-core';
import { createCommand } from 'commander';
import { loadConfigFromTarget } from '../config';
import { promises as fs } from 'fs';
import * as log from '../log';

/* eslint-disable no-console */
export function generateIntegrationDataSourcesCommand() {
  return createCommand('generate-integration-data-sources')
    .description(
      'generate integration data sources from ingestion config and steps data',
    )
    .option(
      '-o, --output-file <path>',
      'project relative path to generated integration data sources file',
    )
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .action(async (options) => {
      const { projectPath, outputFile } = options;

      log.info(
        `Generating integration data sources (projectPath=${projectPath}, outputFile=${outputFile})`,
      );
      const config = await loadConfigFromTarget(projectPath);
      if (!config.ingestionConfig) {
        log.info(
          'Skipping the generation of integration data sources file as there is no ingestionConfig present.',
        );
      } else {
        const ingestionDataSources = generateIntegrationIngestionDataSources(
          config.ingestionConfig,
          config.integrationSteps,
        );
        if (outputFile) {
          await fs.writeFile(outputFile, JSON.stringify(ingestionDataSources), {
            encoding: 'utf-8',
          });
        } else {
          console.log(JSON.stringify(ingestionDataSources, null, 2));
        }
        log.info('Successfully generated integration data sources file');
      }
    });
}

export type EnhancedIntegrationIngestionConfigFieldMap = Record<
  IntegrationSourceId,
  IntegrationIngestionConfigField & { childIngestionSources?: string[] }
>;

/**
 * Generates an ingestionConfig with childIngestionSources taking into account
 * the integration steps that come as argument.
 * The childIngestionSources will be the list of stepIds that have any dependencies
 * on the steps that match the ingestion sources specified.
 *
 * @export
 * @template TStepExecutionContext
 * @param {IntegrationIngestionConfigData} ingestionConfigData ingestionData without childIngestionSources
 * @param {Step<TStepExecutionContext>[]} integrationSteps total list of integration steps
 * @return {*}  {IntegrationIngestionConfigFieldMap} ingestionData with childIngestionSources
 */
export function generateIntegrationIngestionDataSources<
  TStepExecutionContext extends StepExecutionContext,
>(
  ingestionConfig: IntegrationIngestionConfigFieldMap,
  integrationSteps: Step<TStepExecutionContext>[],
): EnhancedIntegrationIngestionConfigFieldMap {
  const newIngestionConfig: EnhancedIntegrationIngestionConfigFieldMap = {};
  Object.keys(ingestionConfig).forEach((key) => {
    if (ingestionConfig[key]) {
      // Get the stepIds that match the current ingestionSourceId
      const matchedIntegrationStepIds = integrationSteps
        .filter((step) => step.ingestionSourceId === key)
        .map(({ id }) => id);
      // Get the stepIds that have any dependencies on the matched step ids
      const childIngestionSources = integrationSteps
        .filter((step) =>
          step.dependsOn?.some((value) =>
            matchedIntegrationStepIds.includes(value),
          ),
        )
        .map(({ id }) => id);
      // Generate ingestionConfig with the childIngestionSources
      newIngestionConfig[key] = {
        ...ingestionConfig[key],
        childIngestionSources,
      };
    } else {
      log.warn(`The key ${key} does not exist in the ingestionConfig`);
    }
  });
  return newIngestionConfig;
}
