import {
  GraphObjectSchema,
  IntegrationInstanceConfig,
  IntegrationStepExecutionContext,
  Step,
  StepEntityMetadata,
  StepMappedRelationshipMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';
import { createCommand } from 'commander';
import { loadConfigFromModule, loadConfigFromTarget } from '../config';
import { promises as fs } from 'fs';
import * as log from '../log';

/* eslint-disable no-console */
export function generateIntegrationGraphSchemaCommand() {
  return createCommand('generate-integration-graph-schema')
    .description(
      'generate integration graph metadata summary from step metadata',
    )
    .option(
      '-o, --output-file <path>',
      'project relative path to generated integration graph schema file',
    )
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-m, --module-name <module>',
      'name of modules to load (ex "@jupiterone/graph-rumble". Will load using require of package rather than filename)',
    )
    .action(async (options) => {
      const { projectPath, outputFile, moduleName } = options;

      log.info(
        `Generating integration graph schema (projectPath=${projectPath}, outputFile=${outputFile}, moduleName=${moduleName})`,
      );
      let config;
      if (moduleName) {
        config = loadConfigFromModule(moduleName);
      } else {
        config = await loadConfigFromTarget(projectPath);
      }

      const integrationGraphSchema = generateIntegrationGraphSchema(
        config.integrationSteps,
      );

      if (outputFile) {
        await fs.writeFile(outputFile, JSON.stringify(integrationGraphSchema), {
          encoding: 'utf-8',
        });
      } else {
        console.log(JSON.stringify(integrationGraphSchema, null, 2));
      }

      log.info('Successfully generated integration graph schema');
    });
}

type IntegrationGraphSchemaEntityMetadata = {
  resourceName: string;
  _class: string | string[];
  _type: string;
  schema?: GraphObjectSchema;
};

type IntegrationGraphSchemaRelationshipMetadata = {
  _class: string;
  sourceType: string;
  targetType: string;
};

type IntegrationGraphSchemaMappedRelationshipMetadata = {
  sourceType: string;
  _class: string;
  targetType: string;
  direction: 'FORWARD' | 'REVERSE';
};

type IntegrationGraphSchema = {
  entities: IntegrationGraphSchemaEntityMetadata[];
  relationships: IntegrationGraphSchemaRelationshipMetadata[];
  mappedRelationships: IntegrationGraphSchemaMappedRelationshipMetadata[];
};

export function generateIntegrationGraphSchema(
  integrationSteps: Step<
    IntegrationStepExecutionContext<IntegrationInstanceConfig, object>
  >[],
): IntegrationGraphSchema {
  const integrationGraphSchema: IntegrationGraphSchema = {
    entities: [],
    relationships: [],
    mappedRelationships: [],
  };

  // To ensure that we are generating a unique set of metadata, we dedup any
  // entity, relationship, and mapped relationship schemas that may be
  // duplicated across steps (rare, but possible).
  const uniqueEntitySchemaSet = new Set<string>();
  const uniqueRelationshipSchemaSet = new Set<string>();
  const uniqueMappedRelationshipSchemaSet = new Set<string>();

  function getIntegrationGraphSchemaEntityMetadataForStep(
    stepEntityMetadata: StepEntityMetadata[],
  ): IntegrationGraphSchemaEntityMetadata[] {
    const entities: IntegrationGraphSchemaEntityMetadata[] = [];

    for (const entityMetadata of stepEntityMetadata) {
      const entitySchemaKey = getEntitySchemaKey(entityMetadata);

      if (uniqueEntitySchemaSet.has(entitySchemaKey)) continue;
      uniqueEntitySchemaSet.add(entitySchemaKey);

      entities.push(toIntegrationGraphSchemaEntityMetadata(entityMetadata));
    }

    return entities;
  }

  function getIntegrationGraphSchemaRelationshipMetadataForStep(
    stepRelationshipMetadata: StepRelationshipMetadata[],
  ) {
    const relationships: IntegrationGraphSchemaRelationshipMetadata[] = [];

    for (const relationshipMetadata of stepRelationshipMetadata) {
      const relationshipSchemaKey =
        getRelationshipSchemaKey(relationshipMetadata);

      if (uniqueRelationshipSchemaSet.has(relationshipSchemaKey)) continue;
      uniqueRelationshipSchemaSet.add(relationshipSchemaKey);

      relationships.push(
        toIntegrationGraphSchemaRelationshipMetadata(relationshipMetadata),
      );
    }

    return relationships;
  }

  function getIntegrationGraphSchemaMappedRelationshipMetadataForStep(
    stepMappedRelationshipMetadata: StepMappedRelationshipMetadata[],
  ) {
    const mappedRelationships: IntegrationGraphSchemaMappedRelationshipMetadata[] =
      [];

    for (const mappedRelationshipMetadata of stepMappedRelationshipMetadata) {
      const mappedRelationshipSchemaKey = getMappedRelationshipSchemaKey(
        mappedRelationshipMetadata,
      );

      if (uniqueMappedRelationshipSchemaSet.has(mappedRelationshipSchemaKey))
        continue;
      uniqueMappedRelationshipSchemaSet.add(mappedRelationshipSchemaKey);

      mappedRelationships.push(
        toIntegrationGraphSchemaMappedRelationshipMetadata(
          mappedRelationshipMetadata,
        ),
      );
    }

    return mappedRelationships;
  }

  for (const step of integrationSteps) {
    integrationGraphSchema.entities = integrationGraphSchema.entities.concat(
      getIntegrationGraphSchemaEntityMetadataForStep(step.entities),
    );

    integrationGraphSchema.relationships =
      integrationGraphSchema.relationships.concat(
        getIntegrationGraphSchemaRelationshipMetadataForStep(
          step.relationships,
        ),
      );

    if (step.mappedRelationships) {
      integrationGraphSchema.mappedRelationships =
        integrationGraphSchema.mappedRelationships.concat(
          getIntegrationGraphSchemaMappedRelationshipMetadataForStep(
            step.mappedRelationships,
          ),
        );
    }
  }

  return integrationGraphSchema;
}

function getEntitySchemaKey(metadata: StepEntityMetadata) {
  return `${metadata._class}|${metadata._type}`;
}

function getRelationshipSchemaKey(metadata: StepRelationshipMetadata) {
  return `${metadata.sourceType}|${metadata._class}|${metadata.targetType}`;
}

function getMappedRelationshipSchemaKey(
  metadata: StepMappedRelationshipMetadata,
) {
  return `${metadata.sourceType}|${metadata._class}|${metadata.targetType}|${metadata.direction}`;
}

function toIntegrationGraphSchemaEntityMetadata(
  stepEntityMetadata: StepEntityMetadata,
): IntegrationGraphSchemaEntityMetadata {
  return {
    resourceName: stepEntityMetadata.resourceName,
    _class: stepEntityMetadata._class,
    _type: stepEntityMetadata._type,
    schema: stepEntityMetadata.schema,
  };
}

function toIntegrationGraphSchemaRelationshipMetadata(
  relationshipMetadata: StepRelationshipMetadata,
): IntegrationGraphSchemaRelationshipMetadata {
  return {
    _class: relationshipMetadata._class,
    sourceType: relationshipMetadata.sourceType,
    targetType: relationshipMetadata.targetType,
  };
}

function toIntegrationGraphSchemaMappedRelationshipMetadata(
  mappedRelationshipMetadata: StepMappedRelationshipMetadata,
): IntegrationGraphSchemaMappedRelationshipMetadata {
  return {
    sourceType: mappedRelationshipMetadata.sourceType,
    _class: mappedRelationshipMetadata._class,
    targetType: mappedRelationshipMetadata.targetType,
    direction: mappedRelationshipMetadata.direction,
  };
}
