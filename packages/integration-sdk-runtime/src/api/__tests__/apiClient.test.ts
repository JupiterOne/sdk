import { Headers, Response } from 'node-fetch';
import { Readable } from 'stream';
import { JupiterOneApiClient } from '../apiClient';
import { createIntegrationLogger } from '../../logger';
import { RequestOptions } from '@jupiterone/integration-sdk-http-client';

const mockLogger = createIntegrationLogger({ name: 'test' });

/**
 * Subclass that re-declares protected methods as public for testing.
 * This avoids `as any` casts and eslint-disable overrides.
 */
class TestableApiClient extends JupiterOneApiClient {
  public testGetAuthorizationHeaders() {
    return this.getAuthorizationHeaders();
  }

  public testRedactAuthHeaders(err: unknown) {
    return this.redactAuthHeaders(err);
  }

  public override async retryableRequest(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<Response> {
    return super.retryableRequest(endpoint, options);
  }

  public override async request(
    endpoint: string,
    options?: RequestOptions & { rawBody?: Buffer },
  ): Promise<Response> {
    return super.request(endpoint, options);
  }
}

interface ClientOverrides {
  baseUrl?: string;
  account?: string;
  accessToken?: string;
  compressUploads?: boolean;
}

function createClient(overrides?: ClientOverrides) {
  return new TestableApiClient({
    baseUrl: 'https://api.example.com',
    logger: mockLogger,
    account: 'test-account',
    accessToken: 'test-token',
    compressUploads: false,
    ...overrides,
  });
}

function createMockResponse(
  body: Record<string, unknown>,
  status = 200,
  headers?: Record<string, string>,
): Response {
  const responseHeaders = new Headers(headers);
  const serialized = JSON.stringify(body);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: responseHeaders,
    redirected: false,
    type: 'default',
    url: '',
    size: 0,
    timeout: 0,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(serialized),
    buffer: jest.fn().mockResolvedValue(Buffer.from(serialized)),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    blob: jest.fn().mockResolvedValue(new Blob()),
    clone: jest.fn(),
    bodyUsed: false,
    textConverted: jest.fn().mockResolvedValue(serialized),
    body: Readable.from([]),
  } as Response;
}

describe('JupiterOneApiClient', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sets _compressUploads to true by default', () => {
      const client = new JupiterOneApiClient({
        baseUrl: 'https://api.example.com',
        logger: mockLogger,
        account: 'test-account',
        accessToken: 'test-token',
      });
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
      const headers = client.testGetAuthorizationHeaders();
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
      const headers = client.testGetAuthorizationHeaders();
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
        .spyOn(client, 'retryableRequest')
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
        .spyOn(client, 'retryableRequest')
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

      jest.spyOn(client, 'retryableRequest').mockResolvedValue(
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
        .spyOn(client, 'retryableRequest')
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
      const err = {
        config: {
          headers: { Authorization: 'Bearer secret-token' },
        },
        response: {
          config: {
            headers: { Authorization: 'Bearer secret-token' },
          },
        },
      };

      client.testRedactAuthHeaders(err);

      expect(err.config.headers).toBe('[REDACTED]');
      expect(err.response.config.headers).toBe('[REDACTED]');
    });

    it('handles missing config/response gracefully', () => {
      const client = createClient();
      const err = {};

      expect(() => client.testRedactAuthHeaders(err)).not.toThrow();
    });
  });

  describe('post with compression enabled', () => {
    it('compresses data and sends via rawBody when compressUploads is true', async () => {
      const client = createClient({ compressUploads: true });

      const requestSpy = jest
        .spyOn(client, 'request')
        .mockResolvedValue(createMockResponse({ ok: true }));

      await client.post('/upload', { key: 'value' });

      expect(requestSpy).toHaveBeenCalledWith(
        '/upload',
        expect.objectContaining({
          method: 'POST',
          rawBody: expect.any(Buffer),
          headers: expect.objectContaining({
            'Content-Encoding': 'gzip',
          }),
        }),
      );
    });
  });

  describe('post with rawBody (gzip)', () => {
    it('passes rawBody through to request override', async () => {
      const client = createClient();
      const gzipBuffer = Buffer.from('fake-gzip-data');

      const requestSpy = jest
        .spyOn(client, 'request')
        .mockResolvedValue(createMockResponse({ ok: true }));

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

      const requestSpy = jest
        .spyOn(client, 'request')
        .mockResolvedValue(createMockResponse({ ok: true }));

      await client.post('/normal', { key: 'value' });

      expect(requestSpy).toHaveBeenCalledWith(
        '/normal',
        expect.objectContaining({
          method: 'POST',
          body: { key: 'value' },
        }),
      );

      const callArgs = requestSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(callArgs.rawBody).toBeUndefined();
    });
  });

  describe('executeRequest error handling', () => {
    it('redacts auth headers on error and re-throws', async () => {
      const client = createClient();
      const error = new Error('request failed') as Error & {
        config: { headers: string | Record<string, string> };
        response: { config: { headers: string | Record<string, string> } };
      };
      error.config = { headers: { Authorization: 'Bearer secret' } };
      error.response = {
        config: { headers: { Authorization: 'Bearer secret' } },
      };

      jest.spyOn(client, 'retryableRequest').mockRejectedValue(error);

      await expect(client.get('/fail')).rejects.toThrow('request failed');
      expect(error.config.headers).toBe('[REDACTED]');
      expect(error.response.config.headers).toBe('[REDACTED]');
    });
  });
});
