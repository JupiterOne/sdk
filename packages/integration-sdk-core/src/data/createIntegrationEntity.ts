import {
  getSchema,
  IntegrationEntitySchema,
  validateEntityWithSchema,
} from '@jupiterone/data-model';

import { IntegrationError } from '../errors';
import { Entity, EntityRawData } from '../types';
import { parseTimePropertyValue } from './converters';
import { validateRawData } from './rawData';
import { assignTags, ResourceTagList, ResourceTagMap } from './tagging';

const SUPPORTED_TYPES = ['string', 'number', 'boolean', 'array', 'undefined'];

/**
 * Properties to be assigned to a generated entity which are declared in code
 * literals.
 *
 * Many values can be transferred from the `ProviderSourceData` without any
 * additional effort. Other properties must transferred by using code to specify
 * the property value. These properties can be any name/value, but the list
 * certainly includes those of `Entity`, and some properties
 * *must* be provided.
 */
type LiteralAssignments = Entity;

/**
 * A type representing entity data from a provider.
 */
type ProviderSourceData = {
  /**
   * Some providers include a collection of `tags` that will be stored on the
   * generated entity as `tag.propertyName`, `propertyName` when the tag is
   * registered in `tagProperties` or is known to be a common tag property name,
   * and the tag values will be collected in the generated entity as `tags` (a
   * `string[]`);
   */
  tags?:
    | ResourceTagList
    | ResourceTagMap
    | string
    | string[]
    | undefined
    | null;

  [key: string]: any;
};

/**
 * Data used to generate an `Entity`.
 */
export type IntegrationEntityData = {
  /**
   * Data from a provider API that will be selectively transferred to an
   * `Entity`.
   *
   * The common properties defined by data model schemas, selected by the
   * `assign._class`, will be found and transferred to the generated entity.
   */
  source: ProviderSourceData;

  /**
   * Literal property assignments. These values will override anything
   * transferred from the `source` data.
   */
  assign: LiteralAssignments;

  /**
   * The names of properties that will be assigned directly to the entity from
   * tags with matching names.
   *
   * @see assignTags
   */
  tagProperties?: string[];
};

/**
 * A generated `Entity` that includes additional properties
 * specific to the entity class and some properties are guaranteed.
 */
type GeneratedEntity = Entity & { _class: string[] };

export type IntegrationEntityBuilderInput = {
  /**
   * Data used to generate an `Entity`.
   */
  entityData: IntegrationEntityData;

  // The plan is to allow another property that contains metadata to drive the
  // transfer process further, placing transformations that are common to the
  // integration in one place, and allowing transformation reuse across
  // integrations.
};

/**
 * Generates an `Entity` using the provided `entityData`.
 */
export function createIntegrationEntity(
  input: IntegrationEntityBuilderInput,
): GeneratedEntity {
  const generatedEntity = generateEntity(input.entityData);

  validateRawData(generatedEntity);

  if (process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION) {
    validateEntityWithSchema(generatedEntity);
  }

  return generatedEntity;
}

function generateEntity({
  source,
  assign,
  tagProperties,
}: IntegrationEntityData): GeneratedEntity {
  const _rawData: EntityRawData[] = [];
  if (Object.entries(source).length > 0) {
    _rawData.push({ name: 'default', rawData: source });
  }
  if (assign._rawData) {
    _rawData.push(...assign._rawData);
  }

  const _class = Array.isArray(assign._class) ? assign._class : [assign._class];

  const entity: GeneratedEntity = {
    ...whitelistedProviderData(source, _class),
    ...assign,
    _class,
    _rawData,
  };

  if (entity.createdOn === undefined) {
    entity.createdOn =
      (source.createdAt && parseTimePropertyValue(source.createdAt)) ||
      (source.creationDate && parseTimePropertyValue(source.creationDate)) ||
      (source.creationTime && parseTimePropertyValue(source.creationTime)) ||
      (source.creationTimestamp &&
        parseTimePropertyValue(source.creationTimestamp));
  }

  if (entity.active === undefined && source.status) {
    const isActive = new RegExp('(?<!in)active|enabled|online', 'i').test(
      source.status,
    );
    const isInactive = new RegExp('inactive|disabled|offline', 'i').test(
      source.status,
    );

    entity.active = isActive
      ? true // if
      : isInactive
      ? false // else if
      : undefined; // else
  }

  // Remove transferred `source.tags` property from the entity. `tags` is in the
  // schema white list, but the structure isn't what we want `tags` to be.
  // `assignTags` will take care of preparing `tags` properly.
  delete entity.tags;

  assignTags(entity, source.tags, tagProperties);

  // `assignTags` may populate `displayName` from the `source.tags`. When there
  // is an `assign.displayName`, use that instead assuming that an assigned
  // value is meant to override an automatic function.
  if (assign.displayName) {
    entity.displayName = assign.displayName;
  }

  // When a `displayName` is not derived from `source.tags` nor explicitly set
  // by `assign.displayName`, use `entity.name`. This is a last attempt to
  // to provide a value automatically.
  if (!entity.displayName && entity.name) {
    entity.displayName = entity.name as string;
  }

  return entity;
}

/**
 * Validates that the provided value conforms to the supported types.
 * If the value is an array, this function is called recursively on each element
 * to ensure nested arrays are also validated. This function throws an error
 * if it encounters a value type that is not supported.
 *
 * @param value The value to be validated. It can be a single value or an array.
 *              For arrays, each element is validated recursively.
 * @param path The path to the current property being validated, used for error messaging.
 *             This is updated with each recursive call to reflect the current context.
 * @param currentValueDepth The current depth of recursion for array validation. It starts at 1
 *             and increments with each recursive call into deeper array levels.
 *             This parameter is used to prevent validation of nested arrays beyond the first level.
 */
export function validateValueType(
  value: any,
  path: string,
  currentValueDepth: number = 1,
): void {
  // Explicitly allow null values
  if (value === null) {
    return;
  }

  if (Array.isArray(value)) {
    // If the depth is > 1 then we won't allow arrays inside arrays.
    if (currentValueDepth > 1) {
      throw new IntegrationError({
        code: 'UNSUPPORTED_TYPE',
        message: `Unsupported type found at "${path}": Nested arrays are not supported.`,
      });
    }

    // If the value is an array, validate each element
    value.forEach((item, index) => {
      validateValueType(item, `${path}[${index}]`, ++currentValueDepth);
    });
  } else {
    // For non-array values, check if the type is supported
    const valueType = typeof value;
    if (!SUPPORTED_TYPES.includes(valueType)) {
      throw new IntegrationError({
        code: 'UNSUPPORTED_TYPE',
        message: `Unsupported type found at "${path}": ${valueType}`,
      });
    }
  }
}

/**
 * Answers a form of the provider data with only the properties supported by the
 * data model schema.
 *
 * @param source resource data from the resource provider/external system
 * @param _class entity `_class: string[]` value
 */
function whitelistedProviderData(
  source: ProviderSourceData,
  _class: string[],
): Omit<ProviderSourceData, 'tags'> {
  const whitelistedProviderData: ProviderSourceData = {};
  const schemaProperties = schemaWhitelistedPropertyNames(_class);

  for (const [key, value] of Object.entries(source)) {
    // Ensure the property is part of the schema and not null
    if (value != null && schemaProperties.includes(key)) {
      if (key != 'tags') validateValueType(value, key);

      // If validation passes, assign the value to the whitelisted data
      whitelistedProviderData[key] = value;
    }
  }
  return whitelistedProviderData;
}

/**
 * The whitelisted property names for unique combinations of `_class: Array`
 * values seen so far in the program.
 */
export const schemaWhitelists = new Map<string, string[]>();

/**
 * Answers all the property names defined by the schemas referenced in the set
 * of classes. Values are cached to avoid rebuilding, since there could be
 * thousands of entities constructed during a single execution.
 */
export function schemaWhitelistedPropertyNames(_class: string[]): string[] {
  const whitelistKey = _class.join(',');
  let properties = schemaWhitelists.get(whitelistKey);
  if (!properties) {
    properties = [];
    for (const c of _class) {
      const schema = getSchema(c);
      if (!schema) {
        throw new IntegrationError({
          code: 'NO_SCHEMA_FOR_CLASS',
          message: `Class '${c}' does not yet have a schema supported by the SDK!`,
        });
      }
      for (const name of schemaPropertyNames(schema)) {
        properties.push(name);
      }
    }
    schemaWhitelists.set(whitelistKey, properties);
  }
  return properties;
}

function schemaPropertyNames(schema: IntegrationEntitySchema): string[] {
  const names: string[] = [];
  if (schema.properties) {
    names.push(...Object.keys(schema.properties));
  }
  if (schema.allOf) {
    for (const s of schema.allOf) {
      names.push(...schemaPropertyNames(s));
    }
  }
  if (schema.$ref) {
    const refSchema = getSchema(schema.$ref.slice(1));
    if (refSchema) {
      names.push(...schemaPropertyNames(refSchema));
    } else {
      throw new IntegrationError({
        code: 'CANNOT_RESOLVE_SCHEMA_REF',
        message: `Schema $ref '${schema.$ref}' cannot be resolved!`,
      });
    }
  }
  return names;
}
