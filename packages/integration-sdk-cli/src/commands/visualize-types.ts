import * as log from '../log';
import * as path from 'path';
import { createCommand } from 'commander';
import {
  StepEntityMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';
import { promises as fs } from 'fs';
import {
  getSortedJupiterOneTypes,
  TypesCommandArgs,
} from '../utils/getSortedJupiterOneTypes';
import { generateVisHTML } from '../utils/generateVisHTML';
import { Node, Edge } from 'vis';

interface VisualizeTypesCommandArgs extends TypesCommandArgs {
  outputFile: string;
  type: string[];
}

// coercion function to collect multiple values for a flag
const collector = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

export function visualizeTypes() {
  return createCommand('visualize-types')
    .description('Generates a graph of types metadata for all steps')
    .option(
      '-p, --project-path <directory>',
      'Absolute path to the integration project directory. Defaults to the current working directory.',
      process.cwd(),
    )
    .option(
      '-o, --output-file <path>',
      'Absolute path to the HTML file that should be created/overwritten. Defaults to {CWD}/.j1-integration/types-graph/index.html.',
    )
    .option(
      '-t, --type <string>',
      'J1 type(s) to visualize, comma separated if multiple.',
      collector,
      [],
    )
    .action(executeVisualizeTypesAction);
}

async function executeVisualizeTypesAction(
  options: VisualizeTypesCommandArgs,
): Promise<void> {
  const { projectPath } = options;
  const types = options.type.length === 0 ? undefined : options.type;
  const graphFilePath =
    options.outputFile || getDefaultTypesGraphFilePath(projectPath);

  log.info('\nCollecting metadata types from steps...\n');
  const metadata = await getSortedJupiterOneTypes({
    projectPath,
  });

  if (!metadata.entities.length && !metadata.relationships.length) {
    log.info(
      'No entities or relationships found to generate types graph for. Exiting.',
    );
    return;
  }

  log.info('\nGenerating local graph from types metadata...\n');

  const edges = getEdgesFromStepRelationshipMetadata(metadata.relationships, {
    types,
  });
  const nodes = getNodesFromStepEntityMetadata(metadata.entities, {
    types,
    edges,
  });

  const visHtml = generateVisHTML(nodes, edges);

  await fs.mkdir(path.dirname(graphFilePath), { recursive: true });
  await fs.writeFile(graphFilePath, visHtml, 'utf-8');

  log.info(`Visualize metadata graph here: ${graphFilePath}`);
}

function getDefaultTypesGraphFilePath(projectSourceDirectory: string): string {
  return path.join(
    projectSourceDirectory,
    '.j1-integration/types-graph/index.html',
  );
}

function getNodesFromStepEntityMetadata(
  entities: StepEntityMetadata[],
  options?: {
    types?: string[];
    edges?: Edge[];
  },
): Node[] {
  if (options?.types !== undefined && options.edges !== undefined) {
    const targetTypes = new Set<string>();
    for (const edge of options.edges) {
      targetTypes.add(edge.from as string);
      targetTypes.add(edge.to as string);
    }
    return entities
      .filter((e) => targetTypes?.has(e._type))
      .map((e) => ({
        id: e._type,
        label: `${e.resourceName}\n${e._type}\n${e._class}`,
      }));
  } else {
    return entities.map((e) => ({
      id: e._type,
      label: `${e.resourceName}\n${e._type}\n${e._class}`,
    }));
  }
}

function getEdgesFromStepRelationshipMetadata(
  relationships: StepRelationshipMetadata[],
  options?: {
    types?: string[];
  },
): Edge[] {
  return relationships
    .filter((r) => {
      if (options?.types !== undefined) {
        return (
          options.types.includes(r.sourceType) ||
          options.types.includes(r.targetType)
        );
      }
      return true;
    })
    .map((r) => ({
      from: r.sourceType,
      to: r.targetType,
      label: r._class,
    }));
}
