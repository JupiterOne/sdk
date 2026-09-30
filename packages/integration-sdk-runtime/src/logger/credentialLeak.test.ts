import * as http from 'http';
import { AddressInfo } from 'net';
import Logger from 'bunyan';

import { createIntegrationLogger } from './index';

const SECRET = 'super-secret-bearer-token-value';

/**
 * End-to-end regression for TD-9349: an integration logger built via
 * createIntegrationLogger must not emit the request Authorization header when a
 * failed HTTP-client error (with a live, still-attached socket) is logged under
 * the `err` field — the exact shape produced by the synchronization upload path
 * (`handleUploadDataChunkError` -> `logger.info({ err }, 'Handling upload
 * error...')`).
 */
describe('TD-9349 credential leak via err serializer', () => {
  async function makeLiveSocketError(): Promise<any> {
    const server = http.createServer((_req, res) => {
      res.statusCode = 503;
      res.end('unavailable');
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const err = await new Promise<any>((resolve) => {
      const req = http.request(
        {
          port,
          method: 'POST',
          path: '/persister/synchronization/jobs/1/entities',
          headers: { Authorization: `Bearer ${SECRET}` },
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            const error: any = new Error('Request failed with status code 503');
            error.name = 'AxiosError';
            error.code = 'ERR_BAD_RESPONSE';
            // The vector: only a reference to the request (and thus its live
            // socket). No config.headers set on the error.
            error.request = req;
            resolve(error);
          });
        },
      );
      req.end();
    });

    server.close();
    return err;
  }

  test('does not emit the bearer token when logging { err } through the integration logger', async () => {
    const err = await makeLiveSocketError();

    const logger = createIntegrationLogger({ name: 'test-integration' });
    const stream = (logger as any)._logger.streams[0]
      .stream as Logger.RingBuffer;
    expect(stream).toBeDefined();

    // Mirror handleUploadDataChunkError's call exactly.
    logger.info(
      { err, code: err.code, attemptNum: 1 },
      'Handling upload error...',
    );

    const emitted = JSON.stringify(stream.records);
    expect(emitted).not.toContain(SECRET);
    // The non-sensitive error context is still logged.
    expect(emitted).toContain('AxiosError');
    expect(emitted).toContain('Handling upload error...');
  });
});
