import { IntegrationValidationError } from '../error';

describe('IntegrationValidationError', () => {
  test('sets expose field to true', () => {
    const error = new IntegrationValidationError('Mochi');
    expect(error.expose).toEqual(true);
  });
  test('Allows error code to be provided', () => {
    const error = new IntegrationValidationError('Mochi', 'MOCHERONIS');
    expect(error.code).toEqual('MOCHERONIS');
  });
});
