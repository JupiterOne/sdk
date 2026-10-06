import * as https from 'https';
import { AddressInfo } from 'net';
import { Writable } from 'stream';

import { createApiClient } from '../../api';
import { createIntegrationLogger } from '../../logger';
import { uploadDataChunk } from '../index';

const SECRET = 'super-secret-bearer-token-value';

// Self-signed localhost cert (expires 2036) so the client uses a real TLS
// socket, which is where Symbol(connect-options) exposes the auth header.
const TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCxs1dtYOoABwHB
mzaKlpyjdTHCezKB1dquTa+isRiUhNpiVMqPcHh/E1ryonyf88tkbc9I+R7OQ8fX
/JdUIMc3rabDN5MLltUTSPF84k/W5KPQr6580bzHFNZXPGs+s/iQnmiOmIVyUW4o
z7a1EkoOHtVEA4sn1yPWiANexA4VdJxb+fLqx+3/g8R5lw23SStUWfjrG9JIcaiU
5moLaNkRgBfk6/RizMWSCcoXbSx3N2qMp+Xo+hZanQM7pzMKjAaKDCq4iEPaavQz
sV1bENFrPvzVnIjnYSX0LPQZJLAG15HlPqQBzOZKYBavqHjo9kXNPSxI1f3mVouI
Dz9sDduvAgMBAAECggEALzG3xvtlulMiEsbDsgP1Hu5ppEKu88+VsBQ+0MEjC5LL
IzFsyLKwteMwlN81pQ+NFaOaWUGcfmB/C2xwzm2UK0Pp1dAFNB8/gMsvI6FBXgvE
PBDkkQ7tCZyNnoaT3wfSPKptj22Ph4B79sfPuQBd/akPr+wXAaJASOI/ruP375di
mARV/cyGEFLqGujAdv/i4PgXhCJ59LOF7mmfyvhQjpBMObdjT4C9cDpDHohRTGU+
1WRCKVgfZcBMLSahSMYClTp595ucItUGDBbxC7oLHV76ThwGppgtJSFQYlG0KMyj
Hk9ufiY6V6lWwJ4dxe5vGxZNVzSlyw0D02JUc2PuPQKBgQDoYMH0oZcObXOxA89F
Eq38ghHYxnrPCsilAfm1aiiBfW81lNyPZVXdvlQB78CDMTX5ndWtrLnHWsFued9x
FvvAIhCrBkjzuWZHIrHAyX8/Slt0+b/EuGzjnDWRnuNdqVftd52ufVWcE3yRfqzH
cvh0rmUXZQJWrigf+v4fuXczFQKBgQDDw7JzsqWif3M9BSYQWR6dhfR9H6pFH2nc
/QrAQVL/sUr58sIgKmdtIEMioly0JZpwDGPmzZOj+guTB47RCxHp1J9E+xDCNH1C
5SOwNWv2/WPCf5J601VOa/ZkRR0ntGOaS5JXmpdFxjNmkedHtbBR5WGcGbWtprq8
d/OGwrmUswKBgBQr+go7ULqO48EU/JQZaAMIY3Y23IhGfl5cioml+ngrJFE5Z+AG
wupp0C8O2d5Jkk7l1Zuq58GXbj0h1TSi8x2dl2bRN9n4WRmJuHZsx1/+G2xPFceE
3ubvM3M9oK0LuzdA7+4qsRjIVELpBSSXJVwzm1DpksdlfNQx3IdyeRd1AoGADlK0
LMjmW4RNrypARbPvjIDviXQWpiYNPdD5x2VAKFsVbEI5t9bCaHaS0ubkN34E1avi
Z1GlOrshu6ky5tKThfM7j/V6nWrvu0Q+nzbZZmHVubZRxlDODgXSKjXwUyZcnz5m
P6ic5ssAmcGVFWcStns88AnlhAYN5Zo1JCf9IgcCgYAYs0564jx+Wie7U9qwN0eA
OsgC0RHD7d855ljpmPDw/f4SY9WSP+qtPat0Nw63vgA/JQbbWRhKJ3kkrHPAa+Tp
6yLBoF/aqk3Rco7heht7nWXQ5gBL7nxB30fYHSUAlZ53g75jiLMWQX7xj3px9XZ2
a1xxvzpejIVNsTzgJa0htA==
-----END PRIVATE KEY-----`;

const TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUW7QsSOMlT/BVKa+VwG+ZfFN3VoAwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDkzMDIzMjMxNFoXDTM2MDky
NzIzMjMxNFowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAsbNXbWDqAAcBwZs2ipaco3UxwnsygdXark2vorEYlITa
YlTKj3B4fxNa8qJ8n/PLZG3PSPkezkPH1/yXVCDHN62mwzeTC5bVE0jxfOJP1uSj
0K+ufNG8xxTWVzxrPrP4kJ5ojpiFclFuKM+2tRJKDh7VRAOLJ9cj1ogDXsQOFXSc
W/ny6sft/4PEeZcNt0krVFn46xvSSHGolOZqC2jZEYAX5Ov0YszFkgnKF20sdzdq
jKfl6PoWWp0DO6czCowGigwquIhD2mr0M7FdWxDRaz781ZyI52El9Cz0GSSwBteR
5T6kAczmSmAWr6h46PZFzT0sSNX95laLiA8/bA3brwIDAQABo1MwUTAdBgNVHQ4E
FgQU50e1u5A7vrR3Jrlcx7golr7Y/rQwHwYDVR0jBBgwFoAU50e1u5A7vrR3Jrlc
x7golr7Y/rQwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAnpYe
E2OhintJUQOKGPFZ0Jf04JtHq+rF8+RbdVoobP9GrrONoDSExhIjriox1wRdwi31
4wcRCT2nzwAwXFCOV+Z7O+ox1W6I1Y5/mAxrRTcWd79S4snMJDm3aPSlfdu881zI
/odKII7rJXMIhWp9F0pqpptVRQWCzIsYbdQ2oBm6IJXsna16lkWUYqSBEI499voK
7dHnTh2ldnICJXS+R3x98VyhdCSxZdMDkxElZVjWfl3gfQboy3w6hSZXIzFSa3hQ
AHIJuJyfWwc7b0GMP4kgYT10iVeuBss9G8wrdslp8aKH05uQRvrGYhB92q14bAix
p3qCv6FBCsX14XYwDA==
-----END CERTIFICATE-----`;

/**
 * Full-path end-to-end validation for TD-9349 against the real @lifeomic/alpha
 * client over TLS. A mock persister returns sustained 503s while we drive
 * uploadDataChunk, exercising: alpha request -> 503 -> retry -> cleanAxiosError
 * -> handleUploadDataChunkError -> logger.info({ err, 'err.$response' }). The
 * emitted logs must not contain the bearer token.
 */
describe('TD-9349 end-to-end via real alpha client over TLS', () => {
  test('sustained 503s do not leak the bearer token', async () => {
    const server = https.createServer(
      { key: TLS_KEY, cert: TLS_CERT },
      (_req, res) => {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: { code: 'UNAVAILABLE' } }));
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const logger = createIntegrationLogger({ name: 'test-integration' });
    // Capture the exact bytes bunyan writes, as production would to stdout/disk.
    let written = '';
    (logger as any)._logger.addStream({
      level: 'trace',
      stream: new Writable({
        write(chunk, _enc, cb) {
          written += chunk.toString();
          cb();
        },
      }),
    });

    const apiClient = createApiClient({
      apiBaseUrl: `https://localhost:${port}`,
      account: 'test-account',
      accessToken: SECRET,
      retryOptions: { attempts: 2 },
      // Trust the self-signed cert so the request reaches a real TLS socket.
      alphaOptions: {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      } as any,
    });

    let threw = false;
    try {
      await uploadDataChunk({
        logger,
        apiClient,
        jobId: 'job-1',
        type: 'entities',
        batch: [{ _key: 'a', _type: 'thing', _class: 'Resource' }] as any,
      });
    } catch {
      threw = true;
    }

    server.close();

    expect(threw).toBe(true);
    expect(written).toContain('Handling upload error...');
    expect(written).not.toContain(SECRET);
  }, 20000);

  // Guards the assumption above: the raw TLS error leaks without our fix.
  test('the raw TLS error would leak the token (documents the vector)', async () => {
    const server = https.createServer(
      { key: TLS_KEY, cert: TLS_CERT },
      (_req, res) => {
        res.statusCode = 503;
        res.end('x');
      },
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const capturedError = await new Promise<any>((resolve) => {
      const req = https.request(
        {
          port,
          host: 'localhost',
          method: 'POST',
          path: '/persister',
          rejectUnauthorized: false,
          headers: { Authorization: `Bearer ${SECRET}` },
        },
        (res) => {
          res.resume();
          res.on('end', () => {
            const error: any = new Error('503');
            error.name = 'AxiosError';
            error.request = req;
            resolve(error);
          });
        },
      );
      req.end();
    });

    server.close();

    const { inspect } = await import('util');
    expect(inspect(capturedError, false, 10)).toContain(SECRET);
  }, 20000);
});
