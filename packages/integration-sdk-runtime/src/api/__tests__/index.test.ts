import * as http from 'http';
import { AddressInfo } from 'net';
import { inspect } from 'util';
import { gunzipSync } from 'zlib';

import {
  ApiClient,
  ApiResponseError,
  createApiClient,
  getAccountFromEnvironment,
  getApiBaseUrl,
  getApiKeyFromEnvironment,
} from '../index';

describe('getApiBaseUrl', () => {
  test('returns development base url if dev option is set to true', () => {
    expect(getApiBaseUrl({ dev: true })).toEqual(
      'https://api.dev.jupiterone.io',
    );
  });

  test('returns production base url if dev option is set to false', () => {
    expect(getApiBaseUrl({ dev: false })).toEqual(
      'https://api.us.jupiterone.io',
    );
  });

  test('defaults to returning the production base url', () => {
    expect(getApiBaseUrl()).toEqual('https://api.us.jupiterone.io');
  });
});

describe('getApiKeyFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_API_KEY;
  });

  test('returns JUPITERONE_API_KEY environment variable value', () => {
    expect(getApiKeyFromEnvironment()).toEqual('test-key');
  });

  test('throws error if JUPITERONE_API_KEY is not set', () => {
    delete process.env.JUPITERONE_API_KEY;
    expect(() => getApiKeyFromEnvironment()).toThrow(
      /JUPITERONE_API_KEY environment variable must be set/,
    );
  });
});

describe('getAccountFromEnvironment', () => {
  beforeEach(() => {
    process.env.JUPITERONE_ACCOUNT = 'test-account';
  });

  afterEach(() => {
    delete process.env.JUPITERONE_ACCOUNT;
  });

  test('returns JUPITERONE_ACCOUNT environment variable value', () => {
    expect(getAccountFromEnvironment()).toEqual('test-account');
  });

  test('throws error if JUPITERONE_ACCOUNT is not set', () => {
    delete process.env.JUPITERONE_ACCOUNT;
    expect(() => getAccountFromEnvironment()).toThrow(
      /JUPITERONE_ACCOUNT environment variable must be set/,
    );
  });
});

describe('createApiClient', () => {
  test('creates an ApiClient instance', () => {
    const client = createApiClient({
      apiBaseUrl: getApiBaseUrl(),
      account: 'test-account',
      accessToken: 'test-key',
    });
    expect(client).toBeInstanceOf(ApiClient);
  });
});

describe('ApiClient request behavior', () => {
  let server: http.Server;
  let baseUrl: string;
  let lastRequest: {
    method?: string;
    url?: string;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
  };
  let handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: Buffer,
  ) => void;

  beforeEach(async () => {
    handler = (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    };
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        lastRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body,
        };
        handler(req, res, body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => server.close());

  function client(compressUploads = false) {
    return createApiClient({
      apiBaseUrl: baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads,
    });
  }

  test('get returns parsed data and status, sends default headers', async () => {
    handler = (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ job: { id: '1' } }));
    };
    const res = await client().get('/persister/synchronization/jobs/1');
    expect(res.data).toEqual({ job: { id: '1' } });
    expect(res.status).toBe(200);
    expect(lastRequest.headers['authorization']).toBe('Bearer test-key');
    expect(lastRequest.headers['jupiterone-account']).toBe('test-account');
  });

  test('post sends JSON body by default', async () => {
    await client().post('/persister/synchronization/jobs', { name: 'x' });
    expect(lastRequest.headers['content-type']).toContain('application/json');
    expect(JSON.parse(lastRequest.body.toString())).toEqual({ name: 'x' });
  });

  test('gzips ingestion-service entity uploads when compressUploads is set', async () => {
    const url =
      '/persister/synchronization/jobs/478d5718-69a7-4204-90b7-7d9f01de374f/entities';
    await client(true).post(url, { entities: [{ _key: 'a' }] });
    expect(lastRequest.headers['content-encoding']).toBe('gzip');
    expect(JSON.parse(gunzipSync(lastRequest.body).toString())).toEqual({
      entities: [{ _key: 'a' }],
    });
  });

  test('does not gzip non-ingestion-service posts', async () => {
    await client(true).post('/other', { some: 'data' });
    expect(lastRequest.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(lastRequest.body.toString())).toEqual({ some: 'data' });
  });

  test('throws ApiResponseError with response data on non-2xx', async () => {
    handler = (_req, res) => {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { code: 'TOO_LARGE' } }));
    };
    await expect(client().post('/x', {})).rejects.toMatchObject({
      response: { status: 413, data: { error: { code: 'TOO_LARGE' } } },
    });
  });

  // showHidden walks non-enumerable AND symbol-keyed props (e.g. a socket's
  // Symbol(connect-options)) — the path the original axios leak exposed. This is
  // the strong assertion; JSON.stringify would silently skip symbols.
  function deepDump(err: unknown): string {
    return inspect(err, { depth: 20, showHidden: true });
  }

  test('HTTP-error does not expose the credential (deep inspect)', async () => {
    handler = (_req, res) => {
      res.statusCode = 503;
      res.end('unavailable');
    };
    try {
      await client().post('/x', {});
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiResponseError);
      const dumped = deepDump(err);
      expect(dumped).not.toContain('test-key');
      expect(dumped).not.toContain('Authorization');
      expect(dumped).not.toContain('connect-options');
      expect((err as any).request).toBeUndefined();
    }
  });

  test('transport failure does not expose the credential (deep inspect)', async () => {
    // Point at a port with no listener so undici throws a connection error,
    // the closest analog to the original live-socket leak.
    const deadClient = createApiClient({
      apiBaseUrl: 'http://127.0.0.1:1',
      account: 'test-account',
      accessToken: 'test-key',
    });
    try {
      await deadClient.post('/x', { any: 'body' });
      throw new Error('expected throw');
    } catch (err) {
      const dumped = deepDump(err);
      expect(dumped).not.toContain('test-key');
      expect(dumped).not.toContain('Authorization');
      expect(dumped).not.toContain('connect-options');
    }
  }, 15000);

  test('retries retryable 5xx then succeeds', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      if (calls < 3) {
        res.statusCode = 503;
        res.end('try again');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      }
    };
    const res = await client().get('/x');
    expect(res.data).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  test('does not retry non-retryable 4xx', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      res.statusCode = 400;
      res.end('bad');
    };
    await expect(client().get('/x')).rejects.toBeInstanceOf(ApiResponseError);
    expect(calls).toBe(1);
  });

  test('config.retry=false disables retry', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      res.statusCode = 503;
      res.end('try again');
    };
    await expect(
      client().post('/x', {}, { retry: false }),
    ).rejects.toBeInstanceOf(ApiResponseError);
    expect(calls).toBe(1);
  });
});

describe('proxy configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates a client without proxy when none provided', () => {
    expect(
      createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'a',
        accessToken: 't',
      }),
    ).toBeInstanceOf(ApiClient);
  });

  it.each([
    ['proxyUrl param', { proxyUrl: 'https://foo:bar@proxy.example.com:8888' }],
    ['HTTPS_PROXY env', {}],
  ])('creates a client with proxy (%s)', (_label, extra) => {
    if (!('proxyUrl' in extra)) {
      process.env.HTTPS_PROXY = 'https://foo:bar@proxy.example.com:8888';
    }
    expect(
      createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'a',
        accessToken: 't',
        ...extra,
      }),
    ).toBeInstanceOf(ApiClient);
  });

  it('handles proxy URLs without authentication', () => {
    process.env.HTTPS_PROXY = 'https://proxy.example.com:8888';
    expect(
      createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'a',
        accessToken: 't',
      }),
    ).toBeInstanceOf(ApiClient);
  });

  it('throws for invalid proxy URLs', () => {
    process.env.HTTPS_PROXY = 'invalid-url';
    expect(() =>
      createApiClient({
        apiBaseUrl: 'https://api.example.com',
        account: 'a',
        accessToken: 't',
      }),
    ).toThrow();
  });
});
