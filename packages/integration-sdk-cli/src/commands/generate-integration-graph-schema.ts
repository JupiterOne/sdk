import {
  IntegrationInstanceConfig,
  IntegrationStepExecutionContext,
  Step,
  StepEntityMetadata,
  StepMappedRelationshipMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';
import { createCommand } from 'commander';
import path from 'path';
import {
  IntegrationInvocationConfigLoadError,
  loadConfig,
  LoadConfigOptions,
} from '../config';
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
      '--disable-typescript',
      'disable registering ts-node at the start of execution',
      false,
    )
    .action(async (options) => {
      const { projectPath, outputFile, disableTypescript } = options;

      log.info(
        `Generating integration graph schema (projectPath=${projectPath}, outputFile=${outputFile})`,
      );
      const config = await loadConfigFromTarget(projectPath, {
        disableTypescript,
      });

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

function loadConfigFromSrc(projectPath: string, opts: LoadConfigOptions) {
  return loadConfig(path.join(projectPath, 'src'), opts);
}

function loadConfigFromDist(projectPath: string, opts: LoadConfigOptions) {
  return loadConfig(path.join(projectPath, 'dist'), opts);
}

/**
 * The way that integration npm packages are distributed has changed over time.
 * This function handles different cases where the invocation config has
 * traditionally lived to support backwards compatibility and make adoption
 * easier.
 */
async function loadConfigFromTarget(
  projectPath: string,
  opts: LoadConfigOptions,
) {
  let configFromSrcErr: Error | undefined;
  let configFromDistErr: Error | undefined;

  try {
    const configFromSrc = await loadConfigFromSrc(projectPath, opts);
    return configFromSrc;
  } catch (err) {
    configFromSrcErr = err;
  }

  try {
    const configFromDist = await loadConfigFromDist(projectPath, opts);
    return configFromDist;
  } catch (err) {
    configFromDistErr = err;
  }

  const combinedError = configFromDistErr
    ? configFromSrcErr + ', ' + configFromDistErr
    : configFromSrcErr;

  throw new IntegrationInvocationConfigLoadError(
    'Error loading integration invocation configuration. Ensure "invocationConfig" is exported from src/index or dist/index. Additional details: ' +
      combinedError,
  );
}

type IntegrationGraphSchemaEntityMetadata = {
  resourceName: string;
  _class: string | string[];
  _type: string;
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
