/* eslint-disable @typescript-eslint/no-explicit-any */
import { Headers } from 'node-fetch';
import { JupiterOneApiClient } from '../apiClient';

const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  isHandledError: jest.fn(),
} as any;

function createClient(overrides?: Partial<any>) {
  return new JupiterOneApiClient({
    baseUrl: 'https://api.example.com',
    logger: mockLogger,
    account: 'test-account',
    accessToken: 'test-token',
    ...overrides,
  });
}

function createMockResponse(
  body: any,
  status = 200,
  headers?: Record<string, string>,
) {
  const responseHeaders = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: responseHeaders,
    json: jest.fn().mockResolvedValue(body),
    body: {
      [Symbol.asyncIterator]: async function* () {
        // empty body
      },
    },
  };
}

describe('JupiterOneApiClient', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sets _compressUploads to true by default', () => {
      const client = createClient();
      expect(client._compressUploads).toBe(true);
    });

    it('sets _compressUploads to false when explicitly disabled', () => {
      const client = createClient({ compressUploads: false });
      expect(client._compressUploads).toBe(false);
    });
  });

  describe('getAuthorizationHeaders', () => {
    it('returns correct headers with Bearer token', () => {
      const client = createClient({
        account: 'my-account',
        accessToken: 'my-token',
      });
      const headers = (client as any).getAuthorizationHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer my-token',
        'JupiterOne-Account': 'my-account',
        'Content-Type': 'application/json',
      });
    });

    it('omits Authorization header when no accessToken provided', () => {
      const client = createClient({
        account: 'my-account',
        accessToken: undefined,
      });
      const headers = (client as any).getAuthorizationHeaders();
      expect(headers).toEqual({
        'JupiterOne-Account': 'my-account',
        'Content-Type': 'application/json',
      });
      expect(headers.Authorization).toBeUndefined();
    });
  });

  describe('post', () => {
    it('returns { data, status, headers } shape', async () => {
      const responseBody = { id: '123', type: 'entity' };
      const client = createClient();

      jest
        .spyOn(client as any, 'retryableRequest')
        .mockResolvedValue(
          createMockResponse(responseBody, 200, { 'x-request-id': 'req-abc' }),
        );

      const result = await client.post<{ id: string; type: string }>(
        '/entities',
        { name: 'test-entity' },
      );

      expect(result).toEqual({
        data: responseBody,
        status: 200,
        headers: expect.objectContaining({
          'x-request-id': 'req-abc',
        }),
      });
    });

    it('sends POST method with body', async () => {
      const client = createClient();
      const spy = jest
        .spyOn(client as any, 'retryableRequest')
        .mockResolvedValue(createMockResponse({ ok: true }));

      await client.post('/some-endpoint', { key: 'value' });

      expect(spy).toHaveBeenCalledWith(
        '/some-endpoint',
        expect.objectContaining({
          method: 'POST',
          body: { key: 'value' },
        }),
      );
    });
  });

  describe('get', () => {
    it('returns { data, status, headers } shape', async () => {
      const responseBody = { items: [1, 2, 3] };
      const client = createClient();

      jest.spyOn(client as any, 'retryableRequest').mockResolvedValue(
        createMockResponse(responseBody, 200, {
          'content-type': 'application/json',
        }),
      );

      const result = await client.get<{ items: number[] }>('/items');

      expect(result).toEqual({
        data: responseBody,
        status: 200,
        headers: expect.objectContaining({
          'content-type': 'application/json',
        }),
      });
    });

    it('sends GET method without body', async () => {
      const client = createClient();
      const spy = jest
        .spyOn(client as any, 'retryableRequest')
        .mockResolvedValue(createMockResponse({ ok: true }));

      await client.get('/some-endpoint');

      expect(spy).toHaveBeenCalledWith(
        '/some-endpoint',
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('redactAuthHeaders', () => {
    it('redacts headers from error config and response config', () => {
      const client = createClient();
      const err: any = {
        config: {
          headers: { Authorization: 'Bearer secret-token' },
        },
        response: {
          config: {
            headers: { Authorization: 'Bearer secret-token' },
          },
        },
      };

      (client as any).redactAuthHeaders(err);

      expect(err.config.headers).toBe('[REDACTED]');
      expect(err.response.config.headers).toBe('[REDACTED]');
    });

    it('handles missing config/response gracefully', () => {
      const client = createClient();
      const err: any = {};

      expect(() => (client as any).redactAuthHeaders(err)).not.toThrow();
    });
  });

  describe('post with rawBody (gzip)', () => {
    it('passes rawBody through to request override', async () => {
      const client = createClient();
      const gzipBuffer = Buffer.from('fake-gzip-data');
      const mockResponse = createMockResponse({ ok: true });

      // Spy on request() to see what options it receives and short-circuit
      const requestSpy = jest
        .spyOn(client as any, 'request')
        .mockResolvedValue(mockResponse);

      await client.post('/upload', undefined, {
        rawBody: gzipBuffer,
        headers: { 'Content-Encoding': 'gzip' },
      });

      expect(requestSpy).toHaveBeenCalledWith(
        '/upload',
        expect.objectContaining({
          method: 'POST',
          rawBody: gzipBuffer,
          headers: expect.objectContaining({
            'Content-Encoding': 'gzip',
          }),
        }),
      );
    });

    it('does not include rawBody when not provided', async () => {
      const client = createClient();
      const mockResponse = createMockResponse({ ok: true });

      const requestSpy = jest
        .spyOn(client as any, 'request')
        .mockResolvedValue(mockResponse);

      await client.post('/normal', { key: 'value' });

      expect(requestSpy).toHaveBeenCalledWith(
        '/normal',
        expect.objectContaining({
          method: 'POST',
          body: { key: 'value' },
        }),
      );

      // rawBody should be undefined (not present) when not passed
      const callArgs = requestSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs.rawBody).toBeUndefined();
    });
  });

  describe('executeRequest error handling', () => {
    it('redacts auth headers on error and re-throws', async () => {
      const client = createClient();
      const error: any = new Error('request failed');
      error.config = { headers: { Authorization: 'Bearer secret' } };
      error.response = {
        config: { headers: { Authorization: 'Bearer secret' } },
      };

      jest.spyOn(client as any, 'retryableRequest').mockRejectedValue(error);

      await expect(client.get('/fail')).rejects.toThrow('request failed');
      expect(error.config.headers).toBe('[REDACTED]');
      expect(error.response.config.headers).toBe('[REDACTED]');
    });
  });
});
