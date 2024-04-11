import { ajvErrorToEntityValidationError } from '../entityValidationError';

describe('entityValidationError', () => {
  test('should return property key with required keyword', () => {
    expect(
      ajvErrorToEntityValidationError({
        instancePath: '',
        schemaPath: '#/required',
        keyword: 'required',
        params: { missingProperty: '_key' },
        message: "must have required property '_key'",
      }),
    ).toEqual({
      property: '_key',
      message: "must have required property '_key'",
      validation: 'required',
    });
  });

  test('should return property key with required keyword', () => {
    expect(
      ajvErrorToEntityValidationError({
        instancePath: '/_key',
        schemaPath: '#/properties/_key/minLength',
        keyword: 'minLength',
        params: { limit: 10 },
        message: 'must NOT have fewer than 10 characters',
      }),
    ).toEqual({
      property: '_key',
      message: 'must NOT have fewer than 10 characters',
      validation: 'minLength',
    });
  });
});
