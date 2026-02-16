import { RequestHeaders } from '../../src';
import type { ApiClientResponse } from '../../src/api/apiClient';

export function getExpectedRequestHeaders() {
  return {
    headers: {
      [RequestHeaders.CorrelationId]: expect.any(String),
    },
  };
}

/**
 * Creates a mock ApiClientResponse for use in tests
 */
export function createMockResponse<T>(data: T): ApiClientResponse<T> {
  return {
    data,
    status: 200,
    headers: {},
  };
}
