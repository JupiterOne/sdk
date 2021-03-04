import * as dataModel from '@jupiterone/data-model';
import * as deepmerge from 'deepmerge';
import { Entity, ExplicitRelationship } from '@jupiterone/integration-sdk-core';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toMatchGraphObjectSchema<T extends Entity>(
        params: ToMatchGraphObjectSchemaParams,
      ): R;

      toMatchDirectRelationshipSchema<T extends ExplicitRelationship>(
        params: ToMatchRelationshipSchemaParams,
      ): R;
    }
  }
}

const FIND_OUT_MORE =
  '\n\nFind out more about JupiterOne schemas: https://github.com/JupiterOne/data-model/tree/master/src/schemas\n';

function createGraphObjectSchemaValidationError<T>(
  ajv: typeof dataModel.IntegrationSchema,
  data: T,
  index: number,
) {
  const serializedData = JSON.stringify(data, null, 2);
  const serializedErrors = JSON.stringify(ajv.errors, null, 2);

  return {
    message: () =>
      `Error validating graph object against schema (data=${serializedData}, errors=${serializedErrors}, index=${index})${FIND_OUT_MORE}`,
    pass: false,
  };
}

function collectSchemasFromRef(
  dataModelIntegrationSchema: typeof dataModel.IntegrationSchema,
  classSchemaRef: string,
): GraphObjectSchema[] {
  const dataModelClassSchema = dataModelIntegrationSchema.getSchema(
    classSchemaRef,
  );

  if (!dataModelClassSchema || !dataModelClassSchema.schema) {
    throw new Error(
      `Invalid _class passed in schema for "toMatchGraphObjectSchema" (_class=${classSchemaRef})${FIND_OUT_MORE}`,
    );
  }

  const dataModelValidationSchema = dataModelClassSchema.schema as dataModel.IntegrationEntitySchema;
  let schemas: GraphObjectSchema[] = [dataModelValidationSchema];

  if (!dataModelValidationSchema.allOf) {
    return schemas;
  }

  for (const allOfProps of dataModelValidationSchema.allOf) {
    const refProp = allOfProps.$ref;
    if (!refProp) {
      continue;
    }

    schemas = schemas.concat(
      collectSchemasFromRef(dataModelIntegrationSchema, refProp),
    );
  }

  return schemas;
}

function dedupSchemaRequiredPropertySchema(
  schema: GraphObjectSchema,
): GraphObjectSchema {
  if (!schema.required) {
    return schema;
  }

  const requiredSet = new Set(schema.required);

  return {
    ...schema,
    required: Array.from(requiredSet),
  };
}

function dedupSchemaPropertyTypes(
  schema: GraphObjectSchema,
): GraphObjectSchema {
  if (!schema.properties) {
    return schema;
  }

  const newProperties: Record<string, any> = {};

  for (const propertyName in schema.properties) {
    const property = schema.properties[propertyName];

    if (Array.isArray(property.type)) {
      newProperties[propertyName] = {
        ...property,
        type: Array.from(new Set(property.type)),
      };
    } else {
      newProperties[propertyName] = property;
    }
  }

  return {
    ...schema,
    properties: newProperties,
  };
}

/**
 * It's possible that two classes contain the same property name and both have
 * "enum" values in the schema.
 *
 * For example, `Host` and `Device` both contain a `platform` property that
 * contain enum values.
 *
 * See here:
 *
 * - https://github.com/JupiterOne/data-model/blob/master/src/schemas/Host.json#L75
 * - https://github.com/JupiterOne/data-model/blob/master/src/schemas/Device.json#L58
 *
 * @param schema
 */
function dedupSchemaEnumValues(schema: GraphObjectSchema): GraphObjectSchema {
  if (!schema.properties) {
    return schema;
  }

  const newProperties: Record<string, any> = {};

  for (const propertyName in schema.properties) {
    const property = schema.properties[propertyName];

    if (property.enum) {
      newProperties[propertyName] = {
        ...property,
        enum: Array.from(new Set(property.enum)),
      };
    } else {
      newProperties[propertyName] = property;
    }
  }

  return {
    ...schema,
    properties: newProperties,
  };
}

function generateGraphObjectSchemaFromDataModelSchemas(
  schemas: GraphObjectSchema[],
) {
  const newSchemas: GraphObjectSchema[] = [];

  for (let schema of schemas) {
    // Remove schema identifying properties
    schema = {
      ...schema,
      $schema: undefined,
      $id: undefined,
      description: undefined,
    };

    if (!schema.allOf) {
      newSchemas.push(schema);
      continue;
    }

    let newSchemaProperties = {};

    // Flatten so `properties` are at the top level
    for (const allOfProp of schema.allOf) {
      if (allOfProp.$ref) {
        continue;
      }

      // Merge the internal properties without $ref's
      newSchemaProperties = deepmerge.all([newSchemaProperties, allOfProp]);
    }

    schema = deepmerge.all([
      {
        ...schema,
        allOf: undefined,
      },
      newSchemaProperties,
    ]);

    newSchemas.push(schema);
  }

  let resultSchema = dedupSchemaPropertyTypes(deepmerge.all(newSchemas));
  resultSchema = dedupSchemaRequiredPropertySchema(resultSchema);
  resultSchema = dedupSchemaEnumValues(resultSchema);

  return resultSchema;
}

function graphObjectClassToSchemaRef(_class: string) {
  return `#${_class}`;
}

export interface GraphObjectSchema extends dataModel.IntegrationEntitySchema {
  $schema?: string;
  $id?: string;
  description?: string;
  additionalProperties?: boolean;
}

export interface ToMatchGraphObjectSchemaParams {
  /**
   * The JupiterOne hierarchy class or classes from the data model that will be used to generate a new schema to be validated against. See: https://github.com/JupiterOne/data-model/tree/master/src/schemas
   */
  _class: string | string[];
  /**
   * The schema that should be used to validate the input data against
   */
  schema?: GraphObjectSchema;
}

export function toMatchGraphObjectSchema<T extends Entity>(
  /**
   * The data received from the test assertion. (e.g. expect(DATA_HERE).toMatchGraphObjectSchema(...)
   */
  received: T | T[],
  { _class, schema }: ToMatchGraphObjectSchemaParams,
) {
  // Copy this so that we do not interfere with globals.
  // NOTE: The data-model should actuall expose a function for generating
  // a new object of the `IntegrationSchema`.
  const dataModelIntegrationSchema = dataModel.IntegrationSchema;
  _class = Array.isArray(_class) ? _class : [_class];
  schema = schema || {};

  let schemas: GraphObjectSchema[] = [];

  for (const classInst of _class) {
    try {
      schemas = schemas.concat(
        collectSchemasFromRef(
          dataModelIntegrationSchema,
          graphObjectClassToSchemaRef(classInst),
        ),
      );
    } catch (err) {
      return {
        message: () => `Error loading schemas for class (err=${err.message})`,
        pass: false,
      };
    }
  }

  const newEntitySchema: GraphObjectSchema = generateGraphObjectSchemaFromDataModelSchemas(
    [
      // Merging should have the highest-level schemas at the end of the array
      // so that they can override the parent classes
      ...schemas.reverse(),
      schema,
    ],
  );

  if (newEntitySchema.properties) {
    newEntitySchema.properties._class = {
      const: _class,
    };
  }

  return toMatchSchema(received, newEntitySchema);
}

export interface ToMatchRelationshipSchemaParams {
  /**
   * The schema that should be used to validate the input data against
   */
  schema?: GraphObjectSchema;
}

export function toMatchDirectRelationshipSchema<T extends ExplicitRelationship>(
  received: T | T[],
  params?: ToMatchRelationshipSchemaParams,
) {
  const dataModelIntegrationSchema = dataModel.IntegrationSchema;
  const schema = params?.schema || {};

  const graphObjectSchemas = collectSchemasFromRef(
    dataModelIntegrationSchema,
    '#GraphObject',
  );

  const directRelationshipSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: '#DirectRelationship',
    description:
      'An edge in the graph database that represents a Relationship. This reference schema defines common shared properties among most Entities.',
    type: 'object',
    allOf: [
      {
        $ref: '#GraphObject',
      },
      {
        additionalProperties: {
          type: ['boolean', 'integer', 'null', 'number', 'string'],
        },
      },
    ],
  };

  return toMatchSchema(
    received,
    generateGraphObjectSchemaFromDataModelSchemas([
      ...graphObjectSchemas.reverse(),
      directRelationshipSchema,
      schema,
    ]),
  );
}

function toMatchSchema<T extends Entity | ExplicitRelationship>(
  received: T | T[],
  schema: GraphObjectSchema,
) {
  const dataModelIntegrationSchema = dataModel.IntegrationSchema;

  received = Array.isArray(received) ? received : [received];

  for (let i = 0; i < received.length; i++) {
    const data = received[i];

    if (dataModelIntegrationSchema.validate(schema, data)) {
      continue;
    }

    return createGraphObjectSchemaValidationError(
      dataModelIntegrationSchema,
      data,
      i,
    );
  }

  const _keys = received.map((r) => r._key);

  if (areKeysDistinct(_keys)) {
    return {
      message: () => 'Success!',
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Object \`_key\` properties array is not unique: [${_keys}]`,
      pass: false,
    };
  }
}

function areKeysDistinct(_keys: string[]): boolean {
  return Array.isArray(_keys) && new Set(_keys).size === _keys.length;
}

export function registerMatchers(expect: jest.Expect) {
  expect.extend({
    toMatchGraphObjectSchema,
    toMatchDirectRelationshipSchema,
  });
}
