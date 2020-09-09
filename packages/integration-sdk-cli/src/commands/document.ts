import * as log from '../log';
import * as path from 'path';
import { createCommand } from 'commander';
import {
  StepGraphObjectMetadataProperties,
  StepEntityMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';
import { promises as fs } from 'fs';
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
    .description('Generates documentation for all steps')
    .option(
      '-p, --project-path <directory>',
      'Absolute path to the integration project directory. Defaults to the current working directory.',
      process.cwd(),
    )
    .option(
      '-o, --output-file <path>',
      'Absolute path to the Markdown file that should be created/updated. Defaults to {CWD}/docs/jupiterone.md.',
    )
    .action(executeDocumentAction);
}

async function executeDocumentAction(
  options: DocumentCommandArgs,
): Promise<void> {
  const { projectPath } = options;
  const documentationFilePath =
    options.outputFile || getDefaultDocumentationFilePath(projectPath);

  log.info('\nCollecting metadata types from steps...\n');
  const metadata = await getSortedJupiterOneTypes({
    projectPath,
  });

  if (!metadata.entities.length && !metadata.relationships.length) {
    log.info(
      'No entities or relationships found to generate documentation for. Exiting.',
    );
    return;
  }

  log.info(
    `\nAttempting to load existing documentation file (path=${documentationFilePath})!\n`,
  );
  const oldDocumentationFile = await getDocumentationFile(
    documentationFilePath,
  );
  log.info('\nExisting documentation file successfully loaded!\n');

  const newGeneratedDocumentationSection = generateGraphObjectDocumentationFromStepsMetadata(
    metadata,
  );

  log.info('\nGenerated integration documentation section:');
  log.info('---------------------------------------------\n');
  log.info(newGeneratedDocumentationSection);

  const newDocumentationFile = replaceBetweenDocumentMarkers(
    oldDocumentationFile,
    newGeneratedDocumentationSection,
  );

  log.info('Attempting to write new documentation...');

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

function getDefaultDocumentationFilePath(
  projectSourceDirectory: string,
): string {
  return path.join(projectSourceDirectory, 'docs/jupiterone.md');
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

function generateGraphObjectDocumentationFromStepsMetadata(
  metadata: StepGraphObjectMetadataProperties,
): string {
  let entitySection = '';
  let relationshipSection = '';

  if (metadata.entities.length) {
    const generatedEntityTable = generateEntityTableFromAllStepEntityMetadata(
      metadata.entities,
    );

    entitySection += `

### Entities

The following entities are created:

${generatedEntityTable}`;
  }

  if (metadata.relationships.length) {
    const generatedRelationshipTable = generateRelationshipTableFromAllStepEntityMetadata(
      metadata.relationships,
    );

    relationshipSection += `

### Relationships

The following relationships are created/mapped:

${generatedRelationshipTable}`;
  }

  return `${J1_DOCUMENTATION_MARKER_START}
<!--
********************************************************************************
NOTE: ALL OF THE FOLLOWING DOCUMENTATION IS GENERATED USING THE
"j1-integration document" COMMAND. DO NOT EDIT BY HAND! PLEASE SEE THE DEVELOPER
DOCUMENTATION FOR USAGE INFORMATION:

https://github.com/JupiterOne/sdk/blob/master/docs/integrations/development.md
********************************************************************************
-->

## Data Model${entitySection}${relationshipSection}

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
