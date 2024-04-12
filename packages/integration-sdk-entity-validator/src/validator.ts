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
          errors.push(
            ...(validator.errors?.map((error) =>
              ajvErrorToEntityValidationError(schemaId, error),
            ) ?? []),
          );
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
      skippedSchemas: skippedSchemas.length ? skippedSchemas : null,
    };
  }
}
