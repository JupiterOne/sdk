import { createCommand } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Edge, Node, Options } from 'vis';

import {
  RelationshipDirection,
  StepEntityMetadata,
  StepGraphObjectMetadataProperties,
  StepMappedRelationshipMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

import * as log from '../log';
import { generateVisHTML } from '../utils/generateVisHTML';
import {
  getSortedJupiterOneTypes,
  TypesCommandArgs,
} from '../utils/getSortedJupiterOneTypes';

const COLORS = {
  J1_PRIMARY_GREEN: '#3ce3b5',
  J1_PRIMARY_PURPLE: '#6647ff',
};

export const PLACEHOLDER_ENTITY_OPTIONS: Partial<Node> = {
  shapeProperties: {
    borderDashes: true,
  },
};

export const MAPPED_RELATIONSHIP_OPTIONS: Partial<Edge> = {
  dashes: true,
};

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
    .description(
      'generate graph visualization of entity and relationship types to collect',
    )
    .option(
      '-p, --project-path <directory>',
      'path to integration project directory',
      process.cwd(),
    )
    .option(
      '-o, --output-file <path>',
      'path of generated HTML file',
      path.join(process.cwd(), '.j1-integration', 'types-graph', 'index.html'),
    )
    .option(
      '-t, --type <string>',
      'J1 entity type(s) to visualize, comma separated',
      collector,
      [],
    )
    .action(executeVisualizeTypesAction);
}

async function executeVisualizeTypesAction(
  options: VisualizeTypesCommandArgs,
): Promise<void> {
  const projectPath = path.resolve(options.projectPath);
  const types = options.type.length === 0 ? undefined : options.type;
  const graphFilePath = options.outputFile
    ? path.resolve(options.outputFile)
    : getDefaultTypesGraphFilePath(projectPath);

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

  const { nodes, edges } = getNodesAndEdgesFromStepMetadata(metadata, {
    types,
  });
  const networkVisualizationOptions: Options = {
    edges: {
      color: COLORS.J1_PRIMARY_PURPLE,
    },
    nodes: {
      color: {
        border: COLORS.J1_PRIMARY_PURPLE,
        background: COLORS.J1_PRIMARY_GREEN,
      },
    },
  };

  const visHtml = generateVisHTML(
    graphFilePath,
    nodes,
    edges,
    networkVisualizationOptions,
  );

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

export function getNodesAndEdgesFromStepMetadata(
  metadata: StepGraphObjectMetadataProperties,
  options?: {
    types?: string[] | undefined;
  },
): { nodes: Node[]; edges: Edge[] } {
  const relationshipEdges = getEdgesFromStepRelationshipMetadata(
    metadata.relationships,
    {
      types: options?.types,
    },
  );
  const {
    placeholderEntityNodes,
    mappedRelationshipEdges,
  } = getNodesAndEdgesFromStepMappedRelationshipMetadata(
    metadata.mappedRelationships || [],
    {
      types: options?.types,
    },
  );
  const entityNodes = getNodesFromStepEntityMetadata(metadata.entities, {
    types: options?.types,
    edges: [...relationshipEdges, ...mappedRelationshipEdges],
  });
  const nodes = deduplicatePlaceholderEntityNodes(
    entityNodes,
    placeholderEntityNodes,
  );
  const edges = deduplicateMappedRelationshipEdges(
    relationshipEdges,
    mappedRelationshipEdges,
  );
  return { nodes, edges };
}

function getNodesFromStepEntityMetadata(
  entities: StepEntityMetadata[],
  options: {
    edges: Edge[] | undefined;
    types: string[] | undefined;
  },
): Node[] {
  if (options.types && options.edges !== undefined) {
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

function getNodesAndEdgesFromStepMappedRelationshipMetadata(
  mappedRelationships: StepMappedRelationshipMetadata[],
  options?: {
    types?: string[];
  },
): { placeholderEntityNodes: Node[]; mappedRelationshipEdges: Edge[] } {
  if (options?.types) {
    mappedRelationships = mappedRelationships.filter(
      (r) =>
        options.types?.includes(r.sourceType) ||
        options.types?.includes(r.targetType),
    );
  }

  const placeholderEntityTypeSet = new Set<string>();
  const placeholderEntityNodes: Node[] = [];
  const mappedRelationshipEdges: Edge[] = [];
  for (const r of mappedRelationships) {
    if (!placeholderEntityTypeSet.has(r.targetType)) {
      placeholderEntityTypeSet.add(r.targetType);
      placeholderEntityNodes.push({
        id: r.targetType,
        label: '\n' + r.targetType + '\n',
        ...PLACEHOLDER_ENTITY_OPTIONS,
      });
    }

    if (r.direction === RelationshipDirection.FORWARD) {
      mappedRelationshipEdges.push({
        from: r.sourceType,
        to: r.targetType,
        label: r._class,
        ...MAPPED_RELATIONSHIP_OPTIONS,
      });
    } else {
      mappedRelationshipEdges.push({
        from: r.targetType,
        to: r.sourceType,
        label: r._class,
        ...MAPPED_RELATIONSHIP_OPTIONS,
      });
    }
  }

  return {
    placeholderEntityNodes,
    mappedRelationshipEdges,
  };
}

function deduplicatePlaceholderEntityNodes(
  entityNodes: Node[],
  placeholderEntityNodes: Node[],
): Node[] {
  const entityTypes = new Set(entityNodes.map((n) => n.id as string));
  return [
    ...entityNodes,
    ...placeholderEntityNodes.filter((n) => !entityTypes.has(n.id as string)),
  ];
}

function deduplicateMappedRelationshipEdges(
  relationshipEdges: Edge[],
  mappedRelationshipEdges: Edge[],
): Edge[] {
  // TODO deduplicate mapped relationship edges
  return [...relationshipEdges, ...mappedRelationshipEdges];
}
