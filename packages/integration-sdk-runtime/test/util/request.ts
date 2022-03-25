import { AxiosRequestConfig } from 'axios';
import { RequestHeaders } from '../../src';

export function getExpectedRequestHeaders() {
  const expectedRequestConfig: AxiosRequestConfig = {
    headers: {
      [RequestHeaders.CorrelationId]: expect.any(String),
    },
  };

  return expectedRequestConfig;
}
