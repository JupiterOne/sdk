import { IntegrationLogger } from '@jupiterone/integration-sdk-runtime';

import Logger, { RingBuffer } from 'bunyan';

export const noopAsync = () => Promise.resolve();

export function createMockIntegrationLogger(): IntegrationLogger {
  const ringbuffer = new RingBuffer({ limit: 100 });

  const quietLogger = new Logger({
    name: 'test',
    streams: [
      {
        level: 'trace',
        type: 'raw',
        // @ts-expect-error - @types/bunyan RingBuffer.end() returns void instead of this
        stream: ringbuffer,
      },
    ],
  });

  return new IntegrationLogger({
    logger: quietLogger,
    errorSet: new Set(),
  });
}
