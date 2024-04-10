import Ajv, { AnySchema, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { addJ1Formats } from './j1Formats';

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

  async validateEntity<
    Entity extends { _class: string[] | string; _type: string },
  >(entity: Entity) {
    const classArray = Array.isArray(entity._class)
      ? entity._class
      : [entity._class];
    let errors: ErrorObject[] = [];

    const typeValidator = this.ajvInstance.getSchema(`#${entity._type}`);

    if (typeValidator) {
      const isValid = await typeValidator(entity);

      if (!isValid) {
        errors = [...errors, ...(typeValidator.errors ?? [])];
      }
    } else {
      for (const className of classArray) {
        const validator = this.ajvInstance.getSchema(`#${className}`);

        if (!validator) {
          throw new Error(`Schema not found for class "${className}"`);
        }

        const isValid = await validator(entity);

        if (!isValid) {
          errors = [...errors, ...(validator.errors ?? [])];
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length ? errors : null,
      validationType: typeValidator ? 'type' : 'class',
    };
  }
}
