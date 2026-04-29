import Ajv, { AnySchema } from 'ajv';
import addFormats from 'ajv-formats';
import { addJ1Formats } from './j1Formats';
import {
  ajvErrorToEntityValidationError,
  unknownPropertySymbol,
  isEntityValidationError,
  EntityValidationError,
} from './entityValidationError';
import { assertEntity } from './assertEntity';

type ValidateEntityResult = {
  isValid: boolean;
  errors: EntityValidationError[] | null;
  warnings: EntityValidationError[] | null;
  skippedSchemas: SkippedSchema[] | null;
};

type SkippedSchema = {
  schemaId: string;
  reason: 'not-found' | 'type-already-validated';
  type: 'type' | 'class';
};

type ValidateEntityOptions = {
  forceClassValidationWithValidatedType?: boolean;
};

/**
 * Properties whose `enum` violations are reclassified as warnings instead of
 * errors by default. New NHI subtypes, AI platforms, and ownership statuses
 * appear in real integrations before the data-model is published, so a strict
 * enum failure here would block ingestion. Type mismatches on these same
 * properties still hard-fail.
 */
export const DEFAULT_PERMISSIVE_ENUM_PROPERTIES: readonly string[] = [
  'nhiType',
  'nhiOwnerStatus',
  'aiConfidence',
];

const convertUnknownErrorToEntityValidationError = (
  error: unknown,
): EntityValidationError => {
  if (isEntityValidationError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      schemaId: 'unknown',
      message: error.message,
      property: unknownPropertySymbol,
      validation: 'unknown',
    };
  }

  return {
    schemaId: 'unknown',
    message: 'Unknown error',
    property: unknownPropertySymbol,
    validation: 'unknown',
  };
};

/**
 * Validates entities against AJV-compiled JSON schemas keyed by `_type` and
 * `_class`. Returns `{ isValid, errors, warnings, skippedSchemas }`.
 *
 * Enum violations on properties listed in `permissiveEnumProperties` (default:
 * {@link DEFAULT_PERMISSIVE_ENUM_PROPERTIES}) are routed to `warnings` and do
 * **not** flip `isValid` to `false`. Every other violation — including type
 * mismatches on those same properties, missing required fields, and enum
 * violations on properties outside the permissive set — still hard-fails.
 *
 * The `warnings` field is purely additive: callers that previously inspected
 * only `isValid`/`errors` continue to behave identically. To opt out of
 * permissive behavior entirely, pass `permissiveEnumProperties: []`.
 *
 * @example
 * ```ts
 * const validator = new EntityValidator({ schemas });
 *
 * // Unknown NHI subtype → warning, entity accepted.
 * validator.validateEntity({ _type: 'svc_account', _class: 'User', nhiType: 'novel_kind' });
 * // → { isValid: true, errors: null, warnings: [{ property: 'nhiType', ... }], ... }
 *
 * // Type mismatch on the same property → hard error.
 * validator.validateEntity({ _type: 'svc_account', _class: 'User', nhiType: 42 });
 * // → { isValid: false, errors: [{ property: 'nhiType', validation: 'type', ... }], ... }
 * ```
 */
export class EntityValidator {
  private ajvInstance: Ajv;
  private permissiveEnumProperties: ReadonlySet<string>;

  constructor({
    schemas,
    permissiveEnumProperties = DEFAULT_PERMISSIVE_ENUM_PROPERTIES,
  }: {
    schemas?: AnySchema[];
    /**
     * Property names whose `enum` violations are partitioned into
     * `warnings` instead of `errors`. Pass `[]` to opt out of permissive
     * behavior entirely. Defaults to {@link DEFAULT_PERMISSIVE_ENUM_PROPERTIES}.
     */
    permissiveEnumProperties?: readonly string[];
  }) {
    this.ajvInstance = addJ1Formats(
      addFormats(
        new Ajv({
          strictSchema: false,
          allErrors: true,
        }),
      ),
    );
    this.permissiveEnumProperties = new Set(permissiveEnumProperties);

    if (schemas) {
      this.addSchemas(schemas);
    }
  }

  addSchemas(schema: AnySchema | AnySchema[]) {
    const schemas = Array.isArray(schema) ? schema : [schema];
    for (const schema of schemas) {
      if (schema !== false && schema !== true && schema.$id) {
        if (this.ajvInstance.getSchema(schema.$id)) {
          this.ajvInstance.removeSchema(schema.$id);
        }
      }
      this.ajvInstance.addSchema(schema);
    }
    return this;
  }

  validateEntity(
    entity: object,
    {
      forceClassValidationWithValidatedType = false,
    }: ValidateEntityOptions = {},
  ): ValidateEntityResult {
    const errors: EntityValidationError[] = [];
    const warnings: EntityValidationError[] = [];
    const skippedSchemas: SkippedSchema[] = [];

    try {
      assertEntity(entity);

      const classArray = Array.isArray(entity._class)
        ? entity._class
        : [entity._class];

      const schemasToValidate: Array<{
        schemaId: string;
        type: 'class' | 'type';
      }> = [
        {
          schemaId: `#${entity._type}`,
          type: 'type' as const,
        },
        ...classArray.map((c) => ({
          schemaId: `#${c}`,
          type: 'class' as const,
        })),
      ];

      for (const i in schemasToValidate) {
        const { schemaId, type } = schemasToValidate[i];
        const validator = this.ajvInstance.getSchema(schemaId);

        if (!validator) {
          skippedSchemas.push({
            schemaId,
            reason: 'not-found',
            type,
          });
          continue;
        }

        const isValid = validator(entity);

        if (!isValid) {
          for (const ajvError of validator.errors ?? []) {
            const validationError = ajvErrorToEntityValidationError(
              schemaId,
              ajvError,
            );
            if (
              ajvError.keyword === 'enum' &&
              typeof validationError.property === 'string' &&
              this.permissiveEnumProperties.has(validationError.property)
            ) {
              warnings.push(validationError);
            } else {
              errors.push(validationError);
            }
          }
        }

        if (type === 'type' && !forceClassValidationWithValidatedType) {
          skippedSchemas.push(
            // Skip each other schema as the type should already have class properties injected
            ...schemasToValidate.slice(Number(i) + 1).map(
              ({ schemaId, type }) =>
                ({
                  schemaId,
                  reason: 'type-already-validated',
                  type,
                }) satisfies SkippedSchema,
            ),
          );
          break;
        }
      }
    } catch (error) {
      errors.push(convertUnknownErrorToEntityValidationError(error));
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length ? errors : null,
      warnings: warnings.length ? warnings : null,
      skippedSchemas: skippedSchemas.length ? skippedSchemas : null,
    };
  }
}
