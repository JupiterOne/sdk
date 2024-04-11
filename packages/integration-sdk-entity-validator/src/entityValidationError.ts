import { ErrorObject } from 'ajv';

export const unknownPropertySymbol = Symbol('_unknown_');

export type EntityValidationError = {
  property: string | typeof unknownPropertySymbol;
  message: string;
  validation: string;
};

const getPropertyNameFromAjvError = (
  error: ErrorObject,
): EntityValidationError['property'] => {
  // instancePath is either '/{propertyName}', or if it's a list: '/{propertyName}/index'
  // instancePath will always start with a slash
  return error.instancePath.split('/')[1] || unknownPropertySymbol;
};

export const ajvErrorToEntityValidationError = (
  error: ErrorObject,
): EntityValidationError => {
  switch (error.keyword) {
    case 'required':
      return {
        property: error.params.missingProperty,
        message:
          error.message ??
          `Property "${error.params.missingProperty}" is required`,
        validation: error.keyword,
      };
    default:
      return {
        property: getPropertyNameFromAjvError(error),
        message: error.message ?? 'Invalid value',
        validation: error.keyword,
      };
  }
};
