import { createCommand } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';

import {
  StepEntityMetadata,
  StepGraphObjectMetadataProperties,
  StepRelationshipMetadata,
  StepMappedRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

import * as log from '../log';
import {
  getSortedJupiterOneTypes,
  TypesCommandArgs,
} from '../utils/getSortedJupiterOneTypes';

const table = require('markdown-table');

const J1_DOCUMENTATION_MARKER_START =
  '<!-- {J1_DOCUMENTATION_MARKER_START} -->';
const J1_DOCUMENTATION_MARKER_END = '<!-- {J1_DOCUMENTATION_MARKER_END} -->';

interface DocumentCommandArgs extends TypesCommandArgs {
  outputFile: string;
}

export function document() {
  return createCommand('document')
    .description('generate documentation for all steps')
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-o, --output-file <path>',
      'project relative path to generated Markdown file',
      path.join('docs', 'jupiterone.md'),
    )
    .action(executeDocumentAction);
}

async function executeDocumentAction(
  options: DocumentCommandArgs,
): Promise<void> {
  const { outputFile } = options;
  const projectPath = path.resolve(options.projectPath);
  const documentationFilePath = path.join(projectPath, outputFile);

  const metadata = await getSortedJupiterOneTypes({
    projectPath,
  });

  if (!metadata.entities?.length && !metadata.relationships?.length) {
    log.info(
      'No entities or relationships found to generate documentation for. Exiting.',
    );
    return;
  }

  const oldDocumentationFile = await getDocumentationFile(
    documentationFilePath,
  );

  const newGeneratedDocumentationSection =
    generateGraphObjectDocumentationFromStepsMetadata(metadata);

  const newDocumentationFile = replaceBetweenDocumentMarkers(
    oldDocumentationFile,
    newGeneratedDocumentationSection,
  );

  await fs.writeFile(documentationFilePath, newDocumentationFile, {
    encoding: 'utf-8',
  });

  log.info('Successfully generated documentation!');
}

async function getDocumentationFile(
  documentationFilePath: string,
): Promise<string> {
  try {
    const file = await fs.readFile(documentationFilePath, {
      encoding: 'utf-8',
    });
    return file;
  } catch (err) {
    log.error(
      `Error loading documentation file from path (path=${documentationFilePath}, err=${err.message})`,
    );
    throw err;
  }
}

function buildEntityClassDocumentationValue(_class: string | string[]): string {
  if (typeof _class === 'string') {
    return `\`${_class}\``;
  }

  return _class.map((c) => `\`${c}\``).join(', ');
}

function generateEntityTableFromAllStepEntityMetadata(
  metadata: StepEntityMetadata[],
): string {
  const generated = table([
    ['Resources', 'Entity `_type`', 'Entity `_class`'],
    ...metadata.map((v) => [
      v.resourceName,
      `\`${v._type}\``,
      buildEntityClassDocumentationValue(v._class),
    ]),
  ]);

  return generated;
}

function generateRelationshipTableFromAllStepEntityMetadata(
  metadata: StepRelationshipMetadata[],
): string {
  const generated = table([
    ['Source Entity `_type`', 'Relationship `_class`', 'Target Entity `_type`'],
    ...metadata.map((v) => [
      `\`${v.sourceType}\``,
      `**${v._class}**`,
      `\`${v.targetType}\``,
    ]),
  ]);

  return generated;
}

function generateMappedRelationshipTableFromAllStepEntityMetadata(
  metadata: StepMappedRelationshipMetadata[],
): string {
  const generated = table([
    [
      'Source Entity `_type`',
      'Relationship `_class`',
      'Target Entity `_type`',
      'Direction',
    ],
    ...metadata.map((v) => [
      `\`${v.sourceType}\``,
      `**${v._class}**`,
      `\`*${v.targetType}*\``,
      `${v.direction}`,
    ]),
  ]);

  return generated;
}

function generateGraphObjectDocumentationFromStepsMetadata(
  metadata: StepGraphObjectMetadataProperties,
): string {
  let entitySection = '';
  let relationshipSection = '';
  let mappedRelationshipSection = '';

  if (metadata.entities?.length) {
    const generatedEntityTable = generateEntityTableFromAllStepEntityMetadata(
      metadata.entities || [],
    );

    entitySection += `

### Entities

The following entities are created:

${generatedEntityTable}`;
  }

  if (metadata.relationships?.length) {
    const generatedRelationshipTable =
      generateRelationshipTableFromAllStepEntityMetadata(
        metadata.relationships || [],
      );

    relationshipSection += `

### Relationships

The following relationships are created:

${generatedRelationshipTable}`;
  }

  if (metadata.mappedRelationships?.length) {
    const generatedMappedRelationshipTable =
      generateMappedRelationshipTableFromAllStepEntityMetadata(
        metadata.mappedRelationships,
      );

    mappedRelationshipSection += `

### Mapped Relationships

The following mapped relationships are created:

${generatedMappedRelationshipTable}`;
  }

  return `${J1_DOCUMENTATION_MARKER_START}
<!--
********************************************************************************
NOTE: ALL OF THE FOLLOWING DOCUMENTATION IS GENERATED USING THE
"j1-integration document" COMMAND. DO NOT EDIT BY HAND! PLEASE SEE THE DEVELOPER
DOCUMENTATION FOR USAGE INFORMATION:

https://github.com/JupiterOne/sdk/blob/main/docs/integrations/development.md
********************************************************************************
-->

## Data Model${entitySection}${relationshipSection}${mappedRelationshipSection}

<!--
********************************************************************************
END OF GENERATED DOCUMENTATION AFTER BELOW MARKER
********************************************************************************
-->
${J1_DOCUMENTATION_MARKER_END}`;
}

function replaceBetweenDocumentMarkers(
  oldDocumentationFile: string,
  newGeneratedDocumentationSection: string,
): string {
  const startIndex = oldDocumentationFile.indexOf(
    J1_DOCUMENTATION_MARKER_START,
  );

  if (startIndex === -1) {
    return oldDocumentationFile + '\n\n' + newGeneratedDocumentationSection;
  }

  const endIndex = oldDocumentationFile.indexOf(J1_DOCUMENTATION_MARKER_END);

  if (endIndex === -1) {
    throw new Error(
      'Could not generate documentation. Documentation starter marker found, but ending marker not found!',
    );
  }

  return (
    oldDocumentationFile.substring(0, startIndex) +
    newGeneratedDocumentationSection +
    oldDocumentationFile.substring(
      // This should never happen, but we should handle the case where there is
      // a start marker, but not an end marker.
      endIndex + J1_DOCUMENTATION_MARKER_END.length,
    )
  );
}
