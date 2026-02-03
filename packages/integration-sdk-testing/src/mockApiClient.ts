import type { ApiClient } from '@jupiterone/integration-sdk-runtime';

export interface MockApiClient {
  apiClient: ApiClient;
  post: jest.Mock;
  get: jest.Mock;
  put: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
  head: jest.Mock;
  options: jest.Mock;
  interceptors: {
    request: { use: jest.Mock; eject: jest.Mock };
    response: { use: jest.Mock; eject: jest.Mock };
  };
}

/**
 * Creates a mock ApiClient with jest mock functions for all HTTP methods.
 *
 * Usage:
 * ```ts
 * const mock = createMockApiClient();
 * mockedCreateApiClient.mockReturnValue(mock.apiClient);
 * mock.get.mockResolvedValue({ data: { items: [] } });
 * ```
 */
export function createMockApiClient(): MockApiClient {
  const post = jest.fn();
  const get = jest.fn();
  const put = jest.fn();
  const patch = jest.fn();
  const del = jest.fn();
  const head = jest.fn();
  const options = jest.fn();
  const interceptors = {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  };

  const apiClient = {
    post,
    get,
    put,
    patch,
    delete: del,
    head,
    options,
    interceptors,
  } as unknown as ApiClient;

  return {
    apiClient,
    post,
    get,
    put,
    patch,
    delete: del,
    head,
    options,
    interceptors,
  };
}
