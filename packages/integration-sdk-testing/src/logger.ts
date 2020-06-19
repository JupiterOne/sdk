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
        stream: ringbuffer,
      },
    ],
  });

  return new IntegrationLogger({
    logger: quietLogger,
    errorSet: new Set(),
  });
}
