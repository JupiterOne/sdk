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

export class EntityValidator {
  private ajvInstance: Ajv;

  constructor({ schemas }: { schemas?: AnySchema[] }) {
    this.ajvInstance = addJ1Formats(
      addFormats(
        new Ajv({
          strictSchema: false,
          allErrors: true,
        }),
      ),
    );

    if (schemas) {
      this.addSchemas(schemas);
    }
  }

  addSchemas(schema: AnySchema | AnySchema[]) {
    this.ajvInstance.addSchema(schema);
    return this;
  }

  validateEntity(
    entity: object,
    {
      forceClassValidationWithValidatedType = false,
    }: ValidateEntityOptions = {},
  ): ValidateEntityResult {
    const errors: EntityValidationError[] = [];
    const skippedSchemas: SkippedSchema[] = [];

    try {
      assertEntity(entity);

      const classArray = Array.isArray(entity._class)
        ? entity._class
        : [entity._class];

      const typeSchemaId = `#${entity._type}`;
      const typeValidator = this.ajvInstance.getSchema(typeSchemaId);

      if (typeValidator) {
        const isValid = typeValidator(entity);

        if (!isValid) {
          errors.push(
            ...(typeValidator.errors?.map((error) =>
              ajvErrorToEntityValidationError(typeSchemaId, error),
            ) ?? []),
          );
        }
      } else {
        skippedSchemas.push({
          schemaId: typeSchemaId,
          reason: 'not-found',
          type: 'type',
        });
      }

      if (!typeValidator || forceClassValidationWithValidatedType) {
        for (const className of classArray) {
          const classSchemaId = `#${className}`;
          const validator = this.ajvInstance.getSchema(classSchemaId);

          if (!validator) {
            skippedSchemas.push({
              schemaId: classSchemaId,
              reason: 'not-found',
              type: 'class',
            });
            continue;
          }

          const isValid = validator(entity);

          if (!isValid) {
            errors.push(
              ...(validator.errors?.map((error) =>
                ajvErrorToEntityValidationError(classSchemaId, error),
              ) ?? []),
            );
          }
        }
      } else {
        skippedSchemas.push(
          ...classArray.map(
            (className) =>
              ({
                schemaId: `#${className}`,
                reason: 'type-already-validated',
                type: 'class',
              }) satisfies SkippedSchema,
          ),
        );
      }
    } catch (error) {
      errors.push(convertUnknownErrorToEntityValidationError(error));
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length ? errors : null,
      skippedSchemas: skippedSchemas.length ? skippedSchemas : null,
    };
  }
}
