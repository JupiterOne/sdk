import { loadConfig } from '../config';
import * as path from 'path';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import {
  IntegrationStepExecutionContext,
  Step,
  StepGraphObjectMetadataProperties,
  StepEntityMetadata,
  StepRelationshipMetadata,
  StepMappedRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

export interface TypesCommandArgs {
  projectPath: string;
}

export async function getSortedJupiterOneTypes(
  options: TypesCommandArgs,
): Promise<StepGraphObjectMetadataProperties> {
  const { projectPath } = options;

  const config = await loadConfig(path.join(projectPath, 'src'));

  return alphabetizeMetadataProperties(
    collectGraphObjectMetadataFromSteps(config.integrationSteps),
  );
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
    mappedRelationships: metadata.mappedRelationships?.sort(
      alphabetizeRelationshipMetadataPropertyByTypeCompareFn,
    ),
  };
}

export function collectGraphObjectMetadataFromSteps(
  steps: Step<IntegrationStepExecutionContext<object>>[],
): StepGraphObjectMetadataProperties {
  const orderedStepNames = buildStepDependencyGraph(steps).overallOrder();
  const integrationStepMap = integrationStepsToMap(steps);

  const entities: StepEntityMetadata[] = [];
  const relationships: StepRelationshipMetadata[] = [];
  const mappedRelationships: StepMappedRelationshipMetadata[] = [];

  // There could be multiple steps that ingest the same entity/relationship
  // `_type`, so we need to deduplicate the data.
  const entityTypeSet = new Set<string>();
  const relationshipTypeSet = new Set<string>();
  const mappedRelationshipTypeSet = new Set<string>();

  for (const stepName of orderedStepNames) {
    const step = integrationStepMap.get(stepName) as Step<
      IntegrationStepExecutionContext<object>
    >;

    for (const e of step.entities) {
      if (entityTypeSet.has(e._type)) {
        continue;
      }

      entityTypeSet.add(e._type);
      entities.push(e);
    }

    for (const r of step.relationships) {
      const relationshipSetValue = toRelationshipSetValue(r);

      if (relationshipTypeSet.has(relationshipSetValue)) {
        continue;
      }

      relationshipTypeSet.add(relationshipSetValue);
      relationships.push(r);
    }

    for (const r of step.mappedRelationships || []) {
      const relationshipSetValue = toMappedRelationshipSetValue(r);

      if (mappedRelationshipTypeSet.has(relationshipSetValue)) {
        continue;
      }

      mappedRelationshipTypeSet.add(relationshipSetValue);
      mappedRelationships.push(r);
    }
  }

  return {
    entities,
    relationships,
    mappedRelationships,
  };
}

function toRelationshipSetValue(r: StepRelationshipMetadata) {
  return `${r._class}:${r._type}:${r.sourceType}:${r.targetType}`;
}

function toMappedRelationshipSetValue(r: StepMappedRelationshipMetadata) {
  return `${r._class}:${r._type}:${r.sourceType}:${r.targetType}:${r.direction}`;
}
