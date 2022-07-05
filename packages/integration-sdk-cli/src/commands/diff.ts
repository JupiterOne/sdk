import { createCommand } from 'commander';
import fs from 'fs';
import { diffString } from 'json-diff';
import path from 'path';

// coercion function to collect multiple values for a flag
const collector = (value: string, arr: string[]) => {
  arr.push(...value.split(','));
  return arr;
};

declare module 'json-diff' {
  /**
   * The exported types from @types/json-diff exclude an optional fourth parameter, `diffOptions`,
   * that allows the user to pass the `keysOnly` flag. Sadly, based on testing, it seems that
   * `keysOnly` does not work under certain circumstances, particularly with diffed arrays.
   *
   * Method signature as exported from @types/json-diff:
   *   function diffString(obj1: unknown, obj2: unknown, colorizeOptions?: ColorizeOptions): string;
   */
  function diffString(
    obj1: unknown,
    obj2: unknown,
    colorizeOptions?: { color?: boolean },
    diffOptions?: { keysOnly?: boolean },
  ): string;
}

export function diff() {
  return createCommand('diff')
    .storeOptionsAsProperties()
    .arguments('<oldExportPath> <newExportPath>')
    .description(
      'compare results from \'find * with _integrationInstanceId="abc-123" that RELATES TO * return tree\'',
    )
    .option('-k, --keys-only', 'only diff _key properties')
    .option(
      '-i, --ignore-types <type-1>,<type-2>',
      'ignore graph objects with _type: <type>',
      collector,
      [],
    )
    .option(
      '-M, --ignore-system-mapper',
      "ignore graph objects with _source: 'system-mapper'",
    )
    .option(
      '-I, --ignore-system-internal',
      "ignore graph objects with _source: 'system-internal'",
    )
    .action((oldExportPath, newExportPath, options) => {
      findDifferences(
        path.resolve(oldExportPath),
        path.resolve(newExportPath),
        {
          keysOnly: options.keysOnly,
          ignoreSystemMapper: options.ignoreSystemMapper,
          ignoreSystemInternal: options.ignoreSystemInternal,
          ignoreTypes: options.ignoreTypes,
        },
      );
    });
}

interface JupiterOneTreeExport {
  type: 'tree';
  data: {
    vertices: VertexExport[];
    edges: EdgeExport[];
  };
}

type EntityAdditionalProperty =
  | string
  | string[]
  | number
  | number[]
  | boolean
  | boolean[];

interface EntityAdditionalProperties {
  [k: string]: EntityAdditionalProperty;
}

interface VertexExport {
  id: string;
  entity: {
    _key: string;
    _type: string | string[];
    _class: string | string[];
    _source: string;
    displayName: string | undefined;
  };
  properties: EntityAdditionalProperties;
}

type RelationshipAdditionalProperty = string | number | boolean;

interface RelationshipAdditionalProperties {
  [k: string]: RelationshipAdditionalProperty;
}

interface EdgeExport {
  id: string;
  toVertexId: string;
  fromVertexId: string;
  relationship: {
    _key: string;
    _type: string | string[];
    _class: string | string[];
    _source: string;
    displayName: string | undefined;
    _fromEntityKey: string;
    _toEntityKey: string;
  };
  properties: RelationshipAdditionalProperties;
}

export function findDifferences(
  oldJsonDataPath: string,
  newJsonDataPath: string,
  options?: {
    keysOnly?: boolean;
    ignoreSystemMapper?: boolean;
    ignoreSystemInternal?: boolean;
    ignoreTypes?: string[];
  },
) {
  const oldExport: JupiterOneTreeExport = JSON.parse(
    fs.readFileSync(oldJsonDataPath, 'utf8'),
  );
  const newExport: JupiterOneTreeExport = JSON.parse(
    fs.readFileSync(newJsonDataPath, 'utf8'),
  );

  diffEntities(oldExport.data.vertices, newExport.data.vertices, options);
  diffRelationships(oldExport.data.edges, newExport.data.edges, options);
}

interface DiffableEntity {
  _type: string | string[];
  _class: string | string[];
  _source: string;
  displayName: string | undefined;
  properties: EntityAdditionalProperties;
}

interface DiffableEntities {
  [_key: string]: DiffableEntity;
}

function diffEntities(
  oldVertices: VertexExport[],
  newVertices: VertexExport[],
  options?: {
    keysOnly?: boolean;
    ignoreSystemMapper?: boolean;
    ignoreSystemInternal?: boolean;
    ignoreTypes?: string[];
  },
) {
  const oldEntities: DiffableEntities = {};
  for (const vertex of oldVertices) {
    if (options?.ignoreSystemMapper) {
      if (vertex.entity._source === 'system-mapper') continue;
    }
    if (options?.ignoreSystemInternal) {
      if (vertex.entity._source === 'system-internal') continue;
    }
    if (options?.ignoreTypes) {
      if (options.ignoreTypes.includes(vertex.entity._type[0] as string))
        continue;
    }
    oldEntities[vertex.entity._key] = {
      _type: vertex.entity._type,
      _class: vertex.entity._class,
      _source: vertex.entity._source,
      displayName: vertex.entity.displayName,
      properties: vertex.properties,
    };
  }

  const newEntities: DiffableEntities = {};
  for (const vertex of newVertices) {
    if (options?.ignoreSystemMapper) {
      if (vertex.entity._source === 'system-mapper') continue;
    }
    if (options?.ignoreSystemInternal) {
      if (vertex.entity._source === 'system-internal') continue;
    }
    if (options?.ignoreTypes) {
      if (options.ignoreTypes.includes(vertex.entity._type[0] as string))
        continue;
    }
    newEntities[vertex.entity._key] = {
      _type: vertex.entity._type,
      _class: vertex.entity._class,
      _source: vertex.entity._source,
      displayName: vertex.entity.displayName,
      properties: vertex.properties,
    };
  }

  console.log('--- ENTITY DIFF ---');
  console.log(
    diffString(oldEntities, newEntities, undefined, {
      keysOnly: options?.keysOnly,
    }),
  );
}

interface DiffableRelationship {
  _type: string | string[];
  _class: string | string[];
  _source: string;
  displayName: string | undefined;
  _fromEntityKey: string;
  _toEntityKey: string;
  properties: RelationshipAdditionalProperties;
}

interface DiffableRelationships {
  [_key: string]: DiffableRelationship;
}

function diffRelationships(
  oldEdges: EdgeExport[],
  newEdges: EdgeExport[],
  options?: {
    keysOnly?: boolean;
    ignoreSystemMapper?: boolean;
    ignoreSystemInternal?: boolean;
    ignoreTypes?: string[];
  },
) {
  const oldRelationships: DiffableRelationships = {};
  for (const edge of oldEdges) {
    if (options?.ignoreSystemMapper) {
      if (edge.relationship._source === 'system-mapper') continue;
    }
    if (options?.ignoreSystemInternal) {
      if (edge.relationship._source === 'system-internal') continue;
    }
    if (options?.ignoreTypes) {
      if (options.ignoreTypes.includes(edge.relationship._type as string))
        continue;
    }
    oldRelationships[edge.relationship._key] = {
      _type: edge.relationship._type,
      _class: edge.relationship._class,
      _source: edge.relationship._source,
      displayName: edge.relationship.displayName,
      _fromEntityKey: edge.relationship._fromEntityKey,
      _toEntityKey: edge.relationship._toEntityKey,
      properties: edge.properties,
    };
  }

  const newRelationships: DiffableRelationships = {};
  for (const edge of newEdges) {
    if (options?.ignoreSystemMapper) {
      if (edge.relationship._source === 'system-mapper') continue;
    }
    if (options?.ignoreSystemInternal) {
      if (edge.relationship._source === 'system-internal') continue;
    }
    if (options?.ignoreTypes) {
      if (options.ignoreTypes.includes(edge.relationship._type as string))
        continue;
    }
    newRelationships[edge.relationship._key] = {
      _type: edge.relationship._type,
      _class: edge.relationship._class,
      _source: edge.relationship._source,
      displayName: edge.relationship.displayName,
      _fromEntityKey: edge.relationship._fromEntityKey,
      _toEntityKey: edge.relationship._toEntityKey,
      properties: edge.properties,
    };
  }

  console.log('--- RELATIONSHIP DIFF ---');
  console.log(
    diffString(oldRelationships, newRelationships, undefined, {
      keysOnly: options?.keysOnly,
    }),
  );
}
