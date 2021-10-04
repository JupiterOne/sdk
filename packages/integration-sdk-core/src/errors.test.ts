import { IntegrationError } from '.';

test('should append cause stack trace to current stack trace', () => {
  const cause = new Error('GENERIC_ERROR');

  const integrationError = new IntegrationError({
    message: 'SPECIAL_INTEGRATION_ERROR',
    code: 'code',
    cause,
  });
  expect(integrationError.stack).toMatch('Error: SPECIAL_INTEGRATION_ERROR');
  expect(integrationError.stack).toMatch('Error: GENERIC_ERROR');
  expect(integrationError.stack?.endsWith(cause.stack!)).toBe(true);
});
