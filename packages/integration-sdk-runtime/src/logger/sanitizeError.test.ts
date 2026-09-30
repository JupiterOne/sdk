import * as http from 'http';
import { inspect } from 'util';
import { AddressInfo } from 'net';

import { REDACTED, sanitizeError } from './sanitizeError';

const SECRET = 'super-secret-bearer-token-value';

describe('sanitizeError', () => {
  test('redacts credential-bearing string keys anywhere in the graph', () => {
    const err: any = new Error('boom');
    err.config = {
      headers: { Authorization: `Bearer ${SECRET}`, 'X-Api-Key': SECRET },
      data: { password: SECRET, username: 'neil' },
    };

    const out = sanitizeError(err);
    const text = inspect(out, false, 10);

    expect(text).not.toContain(SECRET);
    expect(text).toContain(REDACTED);
    expect(text).toContain('neil'); // non-sensitive data preserved
  });

  test('scrubs inline Bearer tokens in free-text strings', () => {
    const err: any = new Error('request failed');
    err._header = `GET /x HTTP/1.1\r\nAuthorization: Bearer ${SECRET}\r\n\r\n`;

    const text = inspect(sanitizeError(err), false, 10);
    expect(text).not.toContain(SECRET);
  });

  test('redacts sensitive symbol-keyed properties', () => {
    const err: any = new Error('boom');
    const sym = Symbol('authorization');
    err[sym] = `Bearer ${SECRET}`;

    const text = inspect(sanitizeError(err), false, 10);
    expect(text).not.toContain(SECRET);
  });

  test('is cycle-safe', () => {
    const err: any = new Error('boom');
    err.self = err;
    err.nested = { parent: err };

    expect(() => sanitizeError(err)).not.toThrow();
    const text = inspect(sanitizeError(err), false, 10);
    expect(text).toContain('[Circular]');
  });

  test('preserves Error message, name and stack', () => {
    const err = new TypeError('kaboom');
    const out = sanitizeError(err) as any;
    expect(out.name).toBe('TypeError');
    expect(out.message).toBe('kaboom');
    expect(typeof out.stack).toBe('string');
  });

  // The regression: a real failed request keeps a live socket whose
  // Symbol(connect-options) exposes the Authorization header. A depth-10
  // inspect of the raw error leaks it; the sanitized clone must not.
  test('does not leak the Authorization header through the live TLS/TCP socket', async () => {
    const server = http.createServer((_req, res) => {
      res.statusCode = 503;
      res.end('unavailable');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    // Capture the axios-style error shape: a rejected request whose error
    // retains a reference to the ClientRequest and its socket.
    const capturedError = await new Promise<any>((resolve) => {
      const req = http.request(
        {
          port,
          method: 'POST',
          path: '/persister/synchronization',
          headers: { Authorization: `Bearer ${SECRET}` },
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            // Simulate an axios/alpha error that references only the request
            // (and thus its live socket) — NOT config.headers. This isolates
            // the socket-walk vector so the test cannot pass via config
            // redaction alone.
            const error: any = new Error('Request failed with status code 503');
            error.name = 'AxiosError';
            error.request = req;
            resolve(error);
          });
        },
      );
      req.end();
    });

    server.close();

    // Document the vulnerability: the raw error leaks the token via the live
    // socket, even though config.headers was never set on the error.
    const rawText = inspect(capturedError, false, 10);
    expect(rawText).toContain(SECRET);

    // The contract: the sanitized clone must not.
    const safeText = inspect(sanitizeError(capturedError), false, 10);
    expect(safeText).not.toContain(SECRET);
    expect(safeText).toContain('AxiosError');
  });
});
