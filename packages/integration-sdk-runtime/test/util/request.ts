import { ApiRequestConfig, RequestHeaders } from '../../src';

export function getExpectedRequestHeaders() {
  const expectedRequestConfig: ApiRequestConfig = {
    headers: {
      [RequestHeaders.CorrelationId]: expect.any(String),
    },
    retry: false,
  };

  return expectedRequestConfig;
}
