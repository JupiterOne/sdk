import {
  StepExecutionContext,
  IntegrationIngestionConfigFieldMap,
  Step,
  IntegrationIngestionConfigData,
} from '../types';

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
export function createIntegrationIngestionConfig<
  TStepExecutionContext extends StepExecutionContext,
>(
  ingestionConfigData: IntegrationIngestionConfigData,
  integrationSteps: Step<TStepExecutionContext>[],
): IntegrationIngestionConfigFieldMap {
  const ingestionConfig: IntegrationIngestionConfigFieldMap = {};
  Object.keys(ingestionConfigData).forEach((key) => {
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
    ingestionConfig[key] = {
      ...ingestionConfigData[key],
      childIngestionSources,
    };
  });
  return ingestionConfig;
}
