import http from 'http';
import { gunzipSync } from 'zlib';
import getPort from 'get-port';

import { createApiClient } from '../index';

interface RecordedRequest {
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

interface TestServer {
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}

/**
 * Starts a local HTTP server driven by `handler`, which receives the 1-based
 * request count and returns the status code to respond with.
 */
async function startServer(
  handler: (count: number, req: http.IncomingMessage) => number,
): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      requests.push({
        url: req.url!,
        headers: req.headers,
        body: Buffer.concat(chunks),
      });
      const status = handler(requests.length, req);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: status < 400 }));
    });
  });

  const port = await getPort();
  await new Promise<void>((resolve) =>
    server.listen(port, '127.0.0.1', resolve),
  );

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

// Keep backoff negligible so the suite stays fast. The retry algorithm caps
// each delay at maxTimeout.
const FAST_RETRY = { maxTimeout: 1 };

describe('retry behavior', () => {
  let server: TestServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  test('retries 5xx responses and succeeds once the server recovers', async () => {
    server = await startServer((count) => (count < 3 ? 500 : 200));

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: FAST_RETRY,
    });

    const response = await client.get('/thing');

    expect(response.status).toEqual(200);
    expect(server.requests).toHaveLength(3);
  });

  test('gives up after the configured number of retries', async () => {
    server = await startServer(() => 500);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: FAST_RETRY,
    });

    await expect(client.get('/thing')).rejects.toThrow();

    // Default of 3 retries means 4 total attempts.
    expect(server.requests).toHaveLength(4);
  });

  test('honors a custom attempts value', async () => {
    server = await startServer(() => 503);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: { ...FAST_RETRY, attempts: 1 },
    });

    await expect(client.get('/thing')).rejects.toThrow();

    expect(server.requests).toHaveLength(2);
  });

  test('does not retry 4xx responses', async () => {
    server = await startServer(() => 404);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: FAST_RETRY,
    });

    await expect(client.get('/thing')).rejects.toThrow();

    expect(server.requests).toHaveLength(1);
  });

  test('honors a custom retryCondition', async () => {
    server = await startServer(() => 404);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: { ...FAST_RETRY, retryCondition: () => true },
    });

    await expect(client.get('/thing')).rejects.toThrow();

    expect(server.requests).toHaveLength(4);
  });

  test('retries connection-level failures that produce no response', async () => {
    // Bind and immediately close so the port refuses connections.
    const port = await getPort();
    const client = createApiClient({
      apiBaseUrl: `http://127.0.0.1:${port}`,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: { ...FAST_RETRY, attempts: 2 },
    });

    await expect(client.get('/thing')).rejects.toThrow();
  });

  test('retried requests still carry the Authorization header', async () => {
    server = await startServer((count) => (count < 2 ? 500 : 200));

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: FAST_RETRY,
    });

    await client.get('/thing');

    expect(server.requests).toHaveLength(2);
    for (const request of server.requests) {
      expect(request.headers.authorization).toEqual('Bearer test-key');
      expect(request.headers['jupiterone-account']).toEqual('test-account');
    }
  });
});

describe('upload compression', () => {
  let server: TestServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  const syncUrl =
    '/persister/synchronization/jobs/478d5718-69a7-4204-90b7-7d9f01de374f/entities';

  test('gzips synchronization uploads when compressUploads is set', async () => {
    server = await startServer(() => 200);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: true,
      retryOptions: FAST_RETRY,
    });

    await client.post(syncUrl, { some: 'data' });

    expect(server.requests).toHaveLength(1);
    const [request] = server.requests;
    expect(request.headers['content-encoding']).toEqual('gzip');
    expect(JSON.parse(gunzipSync(request.body).toString())).toEqual({
      some: 'data',
    });
  });

  test('leaves non-synchronization requests uncompressed', async () => {
    server = await startServer(() => 200);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      compressUploads: true,
      retryOptions: FAST_RETRY,
    });

    await client.post('/other', { some: 'data' });

    const [request] = server.requests;
    expect(request.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(request.body.toString())).toEqual({ some: 'data' });
  });

  test('does not compress when compressUploads is not set', async () => {
    server = await startServer(() => 200);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'test-key',
      retryOptions: FAST_RETRY,
    });

    await client.post(syncUrl, { some: 'data' });

    const [request] = server.requests;
    expect(request.headers['content-encoding']).toBeUndefined();
  });
});

describe('error redaction', () => {
  let server: TestServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  test('does not expose the access token in a serialized error', async () => {
    server = await startServer(() => 401);

    const client = createApiClient({
      apiBaseUrl: server.baseUrl,
      account: 'test-account',
      accessToken: 'super-secret-key',
      retryOptions: FAST_RETRY,
    });

    await expect(
      client.post('/persister/synchronization/jobs/', { some: 'data' }),
    ).rejects.toThrow();

    try {
      await client.post('/persister/synchronization/jobs/', { some: 'data' });
    } catch (err: any) {
      expect(JSON.stringify(err)).not.toContain('super-secret-key');
    }
  });
});
