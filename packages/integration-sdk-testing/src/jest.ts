import * as dataModel from '@jupiterone/data-model';
import * as deepmerge from 'deepmerge';
import {
  Entity,
  ExplicitRelationship,
  GraphObjectSchema,
  IntegrationInstanceConfig,
  IntegrationInvocationConfig,
  IntegrationSpecConfig,
  IntegrationStepExecutionContext,
  MappedRelationship,
  Relationship,
  RelationshipClass,
  Step,
} from '@jupiterone/integration-sdk-core';
import { SyncExpectationResult } from 'expect/build/types';
import { getMatchers } from 'expect/build/jestMatchersObject';
import { StepTestConfig } from './config';
import { buildStepDependencyGraph } from '@jupiterone/integration-sdk-runtime';
import { filterGraphObjects } from './filterGraphObjects';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /**
       * Used to verify that the full result of an integration step is compliant
       * with the metadata defined for the step. For each entity and
       * relationship defined in the metadata, the matcher checks:
       *   - at least 1 graph object has been produced by the execution handler,
       *   - all graph objects comply with `toMatchGraphObjectSchema` or
       *     `toMatchDirectRelationshipSchema`
       *
       * `toMatchStepMetadata` does not support Mapped Relationships
       *
       * @example
       * ```ts
       * const stepResult = await executeStepWithDependencies({
       *   stepId: Steps.FETCH_USERS.id,
       *   invocationConfig,
       *   instanceConfig,
       * });
       *
       * expect(stepResult).toMatchStepMetadata({
       *   stepId: Steps.FETCH_USERS.id,
       *   invocationConfig,
       * });
       * ```
       */
      toMatchStepMetadata(testConfig: StepTestConfig): R;

      /**
       * Used to verify that a collection of Entities matches the _type, _class,
       * and schema defined for the collection, as well as any additional schema
       * defined for the _class in the @jupiterone/data-model project
       *
       * @example
       * ```ts
       * const { collectedEntities } = await executeStepWithDependencies({
       *   stepId: Steps.FETCH_USERS.id,
       *   invocationConfig,
       *   instanceConfig,
       * });
       *
       * expect(collectedEntities).toMatchGraphObjectSchema({
       *   _class: 'User',
       *   _type: 'acme_user',
       *   schema: {
       *     properties: {
       *       admin: { type: 'boolean' }
       *     }
       *   }
       * })
       * ```
       */
      toMatchGraphObjectSchema(params: ToMatchGraphObjectSchemaParams): R;

      /**
       * Used to verify that a collection of Direct Relationships matches the
       * _type, _class, and schema defined for the collection, as well as any
       * additional schema common to _all_ direct relationships.
       *
       * @example
       * ```ts
       * const { collectedRelationships } = await executeStepWithDependencies({
       *   stepId: Steps.FETCH_USERS.id,
       *   invocationConfig,
       *   instanceConfig,
       * });
       *
       * expect(collectedRelationships).toMatchGraphObjectSchema({
       *   _class: RelationshipClass.HAS,
       *   _type: 'acme_account_has_user',
       *   schema: {
       *     properties: {
       *       displayName: { const: 'HAS' }
       *     }
       *   }
       * })
       * ```
       */
      toMatchDirectRelationshipSchema(
        params?: ToMatchRelationshipSchemaParams,
      ): R;

      /**
       * Used to verify that a collection of Mapped Relationships is able to
       * create actual relationships to a set of Entities by matching on the
       * `targetEntity` and `targetFilterKeys` properties.
       *
       * @example
       * ```ts
       * const {
       *   collectedRelationships: firewallRuleMappedRelationships,
       * } = await executeStepWithDependencies({
       *   stepId: Steps.FETCH_USERS.id,
       *   invocationConfig,
       *   instanceConfig,
       * });
       *
       * const globalInternetEntity = buildGlobalInternetEntity();
       *
       * expect(firewallRuleMappedRelationships).toTargetEntities(
       *   [globalInternetEntity],
       * )
       * ```
       */
      toTargetEntities(
        entities: Entity[],
        options?: ToTargetEntitiesOptions,
      ): R;

      /**
       * Used to verify that an implemented `IntegrationInvocationConfig`
       * matches a specified `IntegrationSpecConfig`
       *
       * @example
       * ```ts
       * import { invocationConfig as implementedConfig } from '.';
       * import { invocationConfig as specConfig } from '../docs/spec/src';
       *
       * test('implemented integration should match spec', () => {
       *   expect(implementedConfig).toImplementSpec(specConfig);
       * });
       * ```
       */
      toImplementSpec<T extends IntegrationInstanceConfig>(
        spec: IntegrationSpecConfig<T>,
      ): R;
    }
  }
}

const FIND_OUT_MORE =
  '\n\nFind out more about JupiterOne schemas: https://github.com/JupiterOne/data-model/tree/main/src/schemas\n';

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
  const dataModelClassSchema =
    dataModelIntegrationSchema.getSchema(classSchemaRef);

  if (!dataModelClassSchema || !dataModelClassSchema.schema) {
    throw new Error(
      `Invalid _class passed in schema for "toMatchGraphObjectSchema" (_class=${classSchemaRef})${FIND_OUT_MORE}`,
    );
  }

  const dataModelValidationSchema =
    dataModelClassSchema.schema as dataModel.IntegrationEntitySchema;
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
 * - https://github.com/JupiterOne/data-model/blob/main/src/schemas/Host.json#L75
 * - https://github.com/JupiterOne/data-model/blob/main/src/schemas/Device.json#L58
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

export interface ToMatchGraphObjectSchemaParams {
  /**
   * The JupiterOne hierarchy class or classes from the data model that will be used to generate a new schema to be validated against. See: https://github.com/JupiterOne/data-model/tree/main/src/schemas
   */
  _class: string | string[];
  _type?: string;
  /**
   * The schema that should be used to validate the input data against
   */
  schema?: GraphObjectSchema;

  disableClassMatch?: boolean;
}

interface ToTargetEntitiesOptions {
  enforceSingleTarget?: boolean;
}

export function toTargetEntities(
  mappedRelationships: MappedRelationship[],
  entities: Entity[],
  options?: ToTargetEntitiesOptions,
) {
  for (const mappedRelationship of mappedRelationships) {
    const _mapping = mappedRelationship._mapping;
    if (!_mapping) {
      throw new Error(
        'expect(mappedRelationships).toTargetEntities() requires relationships with the `_mapping` property!',
      );
    }
    const targetEntity = _mapping.targetEntity;
    for (let targetFilterKey of _mapping.targetFilterKeys) {
      /* type TargetFilterKey = string | string[]; */
      if (!Array.isArray(targetFilterKey)) {
        console.warn(
          'WARNING: Found mapped relationship with targetFilterKey of type string. Please ensure the targetFilterKey was not intended to be of type string[]',
        );
        targetFilterKey = [targetFilterKey];
      }
      const mappingTargetEntities = entities.filter((entity) =>
        (targetFilterKey as string[]).every(
          (k) => targetEntity[k] === entity[k],
        ),
      );

      if (mappingTargetEntities.length === 0) {
        return {
          message: () =>
            `No target entity found for mapped relationship: ${JSON.stringify(
              mappedRelationship,
              null,
              2,
            )}`,
          pass: false,
        };
      } else if (
        options?.enforceSingleTarget &&
        mappingTargetEntities.length > 1
      ) {
        return {
          message: () =>
            `Multiple target entities found for mapped relationship, expected exactly one: ${JSON.stringify(
              { mappedRelationship, mappingTargetEntities },
              null,
              2,
            )}`,
          pass: false,
        };
      }
    }
  }
  return {
    message: () => '',
    pass: true,
  };
}

export function toMatchGraphObjectSchema<T extends Entity>(
  /**
   * The data received from the test assertion. (e.g. expect(DATA_HERE).toMatchGraphObjectSchema(...)
   */
  received: T | T[],
  { _class, _type, schema, disableClassMatch }: ToMatchGraphObjectSchemaParams,
): SyncExpectationResult {
  // Copy this so that we do not interfere with globals.
  // NOTE: The data-model should actuall expose a function for generating
  // a new object of the `IntegrationSchema`.
  const dataModelIntegrationSchema = dataModel.IntegrationSchema;
  const classSchemasToMatch = Array.isArray(_class) ? _class : [_class];
  schema = schema || {};

  let schemas: GraphObjectSchema[] = [];

  if (!disableClassMatch) {
    for (const classInst of classSchemasToMatch) {
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
  }

  const newEntitySchema: GraphObjectSchema =
    generateGraphObjectSchemaFromDataModelSchemas([
      // Merging should have the highest-level schemas at the end of the array
      // so that they can override the parent classes
      ...schemas.reverse(),
      schema,
    ]);

  if (newEntitySchema.properties) {
    newEntitySchema.properties._class = {
      const: _class,
    };
    if (_type) {
      newEntitySchema.properties._type = { const: _type };
    }
  }

  return toMatchSchema(received, newEntitySchema);
}

export interface ToMatchRelationshipSchemaParams {
  _class?: RelationshipClass;
  _type?: string;
  /**
   * The schema that should be used to validate the input data against
   */
  schema?: GraphObjectSchema;
}

export function toMatchDirectRelationshipSchema<T extends ExplicitRelationship>(
  received: T | T[],
  params?: ToMatchRelationshipSchemaParams,
): SyncExpectationResult {
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
          anyOf: [
            { type: 'boolean' },
            { type: 'integer' },
            { type: 'null' },
            { type: 'number' },
            { type: 'string' },
          ],
        },
      },
    ],
  };

  const newRelationshipSchema = generateGraphObjectSchemaFromDataModelSchemas([
    ...graphObjectSchemas.reverse(),
    directRelationshipSchema,
    schema,
  ]);

  if (params?._class) {
    if (!newRelationshipSchema.properties) {
      newRelationshipSchema.properties = {};
    }
    newRelationshipSchema.properties._class = { const: params._class };
  }

  if (params?._type) {
    if (!newRelationshipSchema.properties) {
      newRelationshipSchema.properties = {};
    }
    newRelationshipSchema.properties._type = { const: params._type };
  }

  return toMatchSchema(received, newRelationshipSchema);
}

function toMatchSchema<T extends Entity | ExplicitRelationship>(
  received: T | T[],
  schema: GraphObjectSchema,
): SyncExpectationResult {
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

type StepBase<TConfig extends IntegrationInstanceConfig> = Omit<
  Step<IntegrationStepExecutionContext<TConfig>>,
  'executionHandler'
>;

export function toImplementSpec<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
>(
  integration: IntegrationInvocationConfig<TConfig>,
  spec: IntegrationSpecConfig<TConfig>,
) {
  const unimplementedSteps: string[] = [];

  const implementedStepsProposed: { [id: string]: StepBase<TConfig> } = {};
  const implementedStepsActual: { [id: string]: StepBase<TConfig> } = {};
  const implementedStepsByIdMap: {
    [id: string]: Step<IntegrationStepExecutionContext<TConfig>>;
  } = integration.integrationSteps.reduce(
    (implStepsById, step) => ({ ...implStepsById, [step.id]: step }),
    {},
  );

  for (const specStep of spec.integrationSteps) {
    if (specStep.implemented === false) {
      unimplementedSteps.push(specStep.id);
    } else {
      const stepId = specStep.id;
      const { implemented, ...specStepBase } = specStep;
      implementedStepsProposed[stepId] = specStepBase;

      const implementedStep = implementedStepsByIdMap[specStep.id];

      if (implementedStep) {
        const { executionHandler, ...implementedStepBase } = implementedStep;
        implementedStepsActual[stepId] = implementedStepBase;
      }
    }
  }
  if (unimplementedSteps.length > 0) {
    console.log(
      {
        unimplementedSteps,
      },
      'Spec steps marked as `implemented: false`',
    );
  }
  return getMatchers().toMatchObject.call(
    expect,
    implementedStepsActual,
    implementedStepsProposed,
  );
}

export function toMatchStepMetadata(
  results: {
    collectedEntities: Entity[];
    collectedRelationships: Relationship[];
  },
  testConfig: Omit<StepTestConfig, 'instanceConfig'>,
): SyncExpectationResult {
  const { stepId, invocationConfig } = testConfig;
  const stepDependencyGraph = buildStepDependencyGraph(
    invocationConfig.integrationSteps,
  );

  const step = stepDependencyGraph.getNodeData(stepId);

  let restEntities = results.collectedEntities;
  for (const entityMetadata of step.entities) {
    const { targets, rest } = filterGraphObjects(
      restEntities,
      (e) => e._type === entityMetadata._type,
    );
    if (targets.length === 0) {
      return {
        pass: false,
        message: () =>
          `Expected >0 entities of _type=${entityMetadata._type}, got 0.`,
      };
    }
    const { pass, message } = toMatchGraphObjectSchema(targets, entityMetadata);
    if (pass === false) {
      return {
        pass,
        message,
      };
    }
    restEntities = rest;
  }
  if (restEntities.length > 0) {
    const declaredTypes = step.entities.map((e) => e._type);
    const encounteredTypes = [
      ...new Set(results.collectedEntities.map((e) => e._type)),
    ];
    return {
      pass: false,
      message: () =>
        `Expected 0 additional entities, got ${restEntities.length}. (declaredTypes=${declaredTypes}, encounteredTypes=${encounteredTypes})`,
    };
  }

  const {
    targets: collectedMappedRelationships,
    rest: collectedDirectRelationships,
  } = filterGraphObjects(results.collectedRelationships, isMappedRelationship);

  let restDirectRelationships = collectedDirectRelationships;
  for (const relationshipMetadata of step.relationships) {
    const { targets, rest } = filterGraphObjects(
      restDirectRelationships,
      (r) => r._type === relationshipMetadata._type,
    );
    if (targets.length === 0) {
      return {
        pass: false,
        message: () =>
          `Expected >0 relationships of _type=${relationshipMetadata._type}, got 0.`,
      };
    }
    const { pass, message } = toMatchDirectRelationshipSchema(
      targets as ExplicitRelationship[],
      relationshipMetadata,
    );
    if (pass === false) {
      return {
        pass,
        message,
      };
    }
    restDirectRelationships = rest;
  }
  if (restDirectRelationships.length > 0) {
    const declaredTypes = step.relationships.map((r) => r._type);
    const encounteredTypes = [
      ...new Set(
        results.collectedRelationships
          .filter((r) => !isMappedRelationship(r))
          .map((r) => r._type),
      ),
    ];
    return {
      pass: false,
      message: () =>
        `Expected 0 additional relationships, got ${restDirectRelationships.length}. (declaredTypes=${declaredTypes}, encounteredTypes=${encounteredTypes})`,
    };
  }

  if (step.mappedRelationships && step.mappedRelationships.length > 0) {
    throw new Error(
      'toMatchStepMetadata does not support mapped relationships.',
    );
  }

  if (collectedMappedRelationships.length > 0) {
    const declaredTypes = step.mappedRelationships?.map((r) => r._type);
    const encounteredTypes = [
      ...new Set(
        results.collectedRelationships
          .filter(isMappedRelationship)
          .map((r) => r._type),
      ),
    ];
    return {
      pass: false,
      message: () =>
        `Expected 0 mapped relationships, got ${collectedMappedRelationships.length}. (declaredTypes=${declaredTypes}, encounteredTypes=${encounteredTypes})`,
    };
  }

  return {
    message: () => '',
    pass: true,
  };
}

function isMappedRelationship(r: Relationship): r is MappedRelationship {
  return !!r._mapping;
}

export function registerMatchers(expect: jest.Expect) {
  expect.extend({
    toMatchStepMetadata,
    toMatchGraphObjectSchema,
    toMatchDirectRelationshipSchema,
    toTargetEntities,
    toImplementSpec,
  });
}
