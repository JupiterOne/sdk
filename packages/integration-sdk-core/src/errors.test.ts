import { IntegrationError } from '.';
import {
  IntegrationProviderRetriesExceededError,
  shouldReportErrorToOperator,
} from './errors';

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

test('IntegrationProviderRetriesExceededError should have retryDetails be undefined by default', () => {
  const integrationError = new IntegrationProviderRetriesExceededError({
    endpoint: 'https://example-api/users',
    status: '429',
    statusText: 'Retries exceeded',
  });

  expect(integrationError.stack).toMatch(
    'Provider retries exceeded at https://example-api/users: 429 Retries exceeded',
  );
  expect(integrationError.retryDetails).toBe(undefined);
});

test('IntegrationProviderRetriesExceededError should store retryDetails if specified', () => {
  const integrationError = new IntegrationProviderRetriesExceededError(
    {
      endpoint: 'https://example-api/users',
      status: '429',
      statusText: 'Retries exceeded',
    },
    'Retry detail of any kind',
  );

  expect(integrationError.stack).toMatch(
    'Provider retries exceeded at https://example-api/users: 429 Retries exceeded',
  );
  expect(integrationError.retryDetails).toBe('Retry detail of any kind');
});

test('IntegrationProviderRetriesExceededError should not be delivered to the operators', () => {
  const integrationError = new IntegrationProviderRetriesExceededError({
    endpoint: 'https://example-api/users',
    status: '429',
    statusText: 'Retries exceeded',
  });

  expect(shouldReportErrorToOperator(integrationError)).toBe(false);
  expect(integrationError.stack).toMatch(
    'Provider retries exceeded at https://example-api/users: 429 Retries exceeded',
  );
});
