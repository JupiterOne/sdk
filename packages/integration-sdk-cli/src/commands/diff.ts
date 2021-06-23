import { createCommand } from 'commander';
import fs from 'fs';
import { diffString } from 'json-diff';

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
      'Compare two datasets downloaded from JupiterOne using: \n\n' +
        '\t find * with _integrationInstanceId="abc-123" that RELATES TO * return tree\n\n',
    )
    .option('-k, --keys-only', 'Only diff _key properties.')
    .action((oldExportPath, newExportPath, options) => {
      findDifferences(oldExportPath, newExportPath, options.keysOnly);
      console.log(options.keysOnly);
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
  keysOnly?: boolean,
) {
  const oldExport: JupiterOneTreeExport = JSON.parse(
    fs.readFileSync(oldJsonDataPath, 'utf8'),
  );
  const newExport: JupiterOneTreeExport = JSON.parse(
    fs.readFileSync(newJsonDataPath, 'utf8'),
  );

  diffVertices(oldExport.data.vertices, newExport.data.vertices, keysOnly);
  diffEdges(oldExport.data.edges, newExport.data.edges, keysOnly);
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

function diffVertices(
  oldVertices: VertexExport[],
  newVertices: VertexExport[],
  keysOnly?: boolean,
) {
  const oldEntities: DiffableEntities = {};
  for (const vertex of oldVertices) {
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
    newEntities[vertex.entity._key] = {
      _type: vertex.entity._type,
      _class: vertex.entity._class,
      _source: vertex.entity._source,
      displayName: vertex.entity.displayName,
      properties: vertex.properties,
    };
  }

  console.log(diffString(oldEntities, newEntities, undefined, { keysOnly }));
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

function diffEdges(
  oldEdges: EdgeExport[],
  newEdges: EdgeExport[],
  keysOnly?: boolean,
) {
  const oldRelationships: DiffableRelationships = {};
  for (const edge of oldEdges) {
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

  console.log(
    diffString(oldRelationships, newRelationships, undefined, { keysOnly }),
  );
}
