import { Polly, PollyConfig } from '@pollyjs/core';

export function createTestPolly(
  recordingName: string,
  pollyConfigOverrides?: PollyConfig,
) {
  return new Polly(recordingName, {
    adapters: ['node-http'],
    persister: 'fs',
    logLevel: 'silent',
    matchRequestsBy: {
      headers: false,
    },
    ...pollyConfigOverrides,
  });
}
