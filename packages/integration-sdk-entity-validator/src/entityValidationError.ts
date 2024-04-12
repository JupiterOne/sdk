import { ErrorObject } from 'ajv';

export const unknownPropertySymbol = Symbol('_unknown_');

export type EntityValidationError = {
  schemaId: string | null;
  property: string | typeof unknownPropertySymbol;
  message: string;
  validation: string;
};

export const isEntityValidationError = (
  property: unknown,
): property is EntityValidationError => {
  return (
    typeof property === 'object' &&
    property !== null &&
    'property' in property &&
    'message' in property &&
    'validation' in property
  );
};

const getPropertyNameFromAjvError = (
  error: ErrorObject,
): EntityValidationError['property'] => {
  // instancePath is either '/{propertyName}', or if it's a list: '/{propertyName}/index'
  // instancePath will always start with a slash
  return error.instancePath.split('/')[1] || unknownPropertySymbol;
};

export const ajvErrorToEntityValidationError = (
  schemaId: string,
  error: ErrorObject,
): EntityValidationError => {
  switch (error.keyword) {
    case 'required':
      return {
        schemaId,
        property: error.params.missingProperty,
        message:
          error.message ??
          `Property "${error.params.missingProperty}" is required`,
        validation: error.keyword,
      };
    default:
      return {
        schemaId,
        property: getPropertyNameFromAjvError(error),
        message: error.message ?? 'Invalid value',
        validation: error.keyword,
      };
  }
};
