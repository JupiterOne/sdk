import * as log from '../log';
import { loadConfig } from '../config';
import * as path from 'path';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import { createCommand } from 'commander';
import {
  IntegrationStepExecutionContext,
  Step,
  StepGraphObjectMetadataProperties,
  StepEntityMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';
import { promises as fs } from 'fs';

export interface TypesCommandArgs {
  projectPath: string;
  typesFilePath: string;
}

export function types() {
  return createCommand('types')
    .description('Collects types metadata for all steps')
    .option(
      '-p, --project-path <directory>',
      'Absolute file path to the integration project directory. Defaults to the current working directory.',
      process.cwd(),
    )
    .option(
      '-t, --types-file-path <path>',
      'Absolute file path to the JSON file that should be created/overwritten. Defaults to {CWD}/docs/types.json.',    
    )
    .action(executeTypesAction);
}

export async function executeTypesAction(
  options: TypesCommandArgs,
): Promise<void> {
  const { projectPath } = options;
  const typesFilePath =
    options.typesFilePath ||
    getDefaultTypesFilePath(projectPath);

  log.info('\nFetching metadata types from steps...\n');
  const config = await loadConfig(path.join(projectPath, 'src'));

  log.info('\nConfiguration successfully loaded!\n');

  const metadata = alphabetizeMetadataProperties(
    collectGraphObjectMetadataFromSteps(config.integrationSteps),
  );

  const metadataString = JSON.stringify(metadata, undefined, 2);

  await fs.writeFile(typesFilePath, metadataString, {
    encoding: 'utf-8',
  });

  log.info('Successfully generated types metadata file!');
}

export function getDefaultTypesFilePath(
  projectSourceDirectory: string,
): string {
  return path.join(projectSourceDirectory, 'docs/types.json');
}

function integrationStepsToMap(
  integrationSteps: Step<IntegrationStepExecutionContext<object>>[],
): Map<string, Step<IntegrationStepExecutionContext<object>>> {
  const integrationStepMap = new Map<
    string,
    Step<IntegrationStepExecutionContext<object>>
  >();

  for (const step of integrationSteps) {
    integrationStepMap.set(step.id, step);
  }

  return integrationStepMap;
}

function alphabetizeEntityMetadataPropertyByTypeCompareFn(
  a: StepEntityMetadata,
  b: StepEntityMetadata,
): number {
  if (a.resourceName > b.resourceName) return 1;
  if (a.resourceName < b.resourceName) return -1;
  return 0;
}

function alphabetizeRelationshipMetadataPropertyByTypeCompareFn(
  a: StepRelationshipMetadata,
  b: StepRelationshipMetadata,
): number {
  if (a._type > b._type) return 1;
  if (a._type < b._type) return -1;
  return 0;
}

function alphabetizeMetadataProperties(
  metadata: StepGraphObjectMetadataProperties,
): StepGraphObjectMetadataProperties {
  return {
    entities: metadata.entities.sort(
      alphabetizeEntityMetadataPropertyByTypeCompareFn,
    ),
    relationships: metadata.relationships.sort(
      alphabetizeRelationshipMetadataPropertyByTypeCompareFn,
    ),
  };
}

function collectGraphObjectMetadataFromSteps(
  steps: Step<IntegrationStepExecutionContext<object>>[],
): StepGraphObjectMetadataProperties {
  const orderedStepNames = buildStepDependencyGraph(steps).overallOrder();
  const integrationStepMap = integrationStepsToMap(steps);

  const metadata: StepGraphObjectMetadataProperties = {
    entities: [],
    relationships: [],
  };

  // There could be multiple steps that ingest the same entity/relationship
  // `_type`, so we need to deduplicate the data.
  const entityTypeSet = new Set<string>();
  const relationshipTypeSet = new Set<string>();

  for (const stepName of orderedStepNames) {
    const step = integrationStepMap.get(stepName) as Step<
      IntegrationStepExecutionContext<object>
    >;

    for (const e of step.entities) {
      if (entityTypeSet.has(e._type)) {
        continue;
      }

      entityTypeSet.add(e._type);
      metadata.entities.push(e);
    }

    for (const r of step.relationships) {
      if (relationshipTypeSet.has(r._type)) {
        continue;
      }

      relationshipTypeSet.add(r._type);
      metadata.relationships.push(r);
    }
  }

  return metadata;
}
