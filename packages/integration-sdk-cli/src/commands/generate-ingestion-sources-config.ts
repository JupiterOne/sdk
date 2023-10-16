import {
  IntegrationIngestionConfigField,
  IntegrationIngestionConfigFieldMap,
  IntegrationSourceId,
  Step,
  StepExecutionContext,
  StepMetadata,
} from '@jupiterone/integration-sdk-core';
import { createCommand } from 'commander';
import { loadConfigFromModule, loadConfigFromTarget } from '../config';
import { promises as fs } from 'fs';
import * as log from '../log';

/* eslint-disable no-console */
export function generateIngestionSourcesConfigCommand() {
  return createCommand('generate-ingestion-sources-config')
    .description(
      'generate ingestion sources config from ingestion config and steps data',
    )
    .option(
      '-o, --output-file <path>',
      'project relative path to generated ingestion sources config file',
    )
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-m, --module <mod>',
      'name of modules to load (ex "@jupiterone/graph-rumble". Will load using require of package rather than filename)',
    )
    .action(async (options) => {
      const { projectPath, outputFile, mod } = options;

      log.info(
        `Generating ingestion sources config (projectPath=${projectPath}, outputFile=${outputFile})`,
      );
      let config;
      if (mod) {
        config = await loadConfigFromModule(mod);
      } else {
        config = await loadConfigFromTarget(projectPath);
      }
      if (!config.ingestionConfig) {
        log.info(
          'Skipping the generation of ingestion sources config file as there is no ingestionConfig present.',
        );
      } else {
        const ingestionSourcesConfig = generateIngestionSourcesConfig(
          config.ingestionConfig,
          config.integrationSteps,
        );
        if (outputFile) {
          await fs.writeFile(
            outputFile,
            JSON.stringify(ingestionSourcesConfig),
            {
              encoding: 'utf-8',
            },
          );
        } else {
          console.log(JSON.stringify(ingestionSourcesConfig, null, 2));
        }
        log.info('Successfully generated ingestion sources config file');
      }
    });
}

export type EnhancedIntegrationIngestionConfigFieldMap = Record<
  IntegrationSourceId,
  IntegrationIngestionConfigField & { childIngestionSources?: StepMetadata[] }
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
export function generateIngestionSourcesConfig<
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
      if (!matchedIntegrationStepIds.length) {
        // Skip iteration if there are no steps pointing to the current ingestionSourceId
        return;
      }
      // Get the dependent steps for the given matchedIntegrationStepIds
      const childIngestionSources = integrationSteps.filter(
        (step) =>
          step.dependsOn?.some((value) =>
            matchedIntegrationStepIds.includes(value),
          ),
      );
      // Generate ingestionConfig with the childIngestionSources
      newIngestionConfig[key] = {
        ...ingestionConfig[key],
        // Drop execution handler from returned object
        childIngestionSources: childIngestionSources.map(
          ({ executionHandler, ...keepAttrs }) => keepAttrs,
        ),
      };
    } else {
      log.warn(`The key ${key} does not exist in the ingestionConfig`);
    }
  });
  return newIngestionConfig;
}
