import { RequestHeaders } from '../../src';
import type { RequestClientResponse } from '@jupiterone/platform-sdk-fetch';

export function getExpectedRequestHeaders() {
  return {
    headers: {
      [RequestHeaders.CorrelationId]: expect.any(String),
    },
  };
}

/**
 * Creates a mock RequestClientResponse for use in tests
 */
export function createMockResponse<T>(data: T): RequestClientResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    config: {},
  };
}
