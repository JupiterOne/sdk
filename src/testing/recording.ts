import { Har } from 'har-format';
import defaultsDeep from 'lodash/defaultsDeep';

import { Polly, PollyConfig } from '@pollyjs/core';
import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import FSPersister from '@pollyjs/persister-fs';

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

export type Recording = Polly;

interface SetupRecordingInput {
  directory: string;
  name: string;
  redactedRequestHeaders?: string[];
  redactedResponseHeaders?: string[];
  mutateEntry?: (entry: any) => void;
  options?: PollyConfig;
}

/**
 * Sets up a recording of all http requests and
 * writes the data to disk when it is stopped.
 *
 * This leverages Polly.js to do all the heavy lifting.
 */
export function setupRecording({
  directory,
  name,
  redactedRequestHeaders = [],
  redactedResponseHeaders = [],
  mutateEntry,
  options,
}: SetupRecordingInput): Polly {
  const redactedRequestHeadersSet = new Set<string>(
    redactedRequestHeaders.map((h) => h.toLowerCase()),
  );

  const redactedResponseHeadersSet = new Set<string>([
    ...redactedResponseHeaders.map((h) => h.toLowerCase()),
    'set-cookie',
  ]);

  class JupiterOneIntegationFSPersister extends FSPersister {
    static get id(): string {
      return 'JupiterOneIntegationFSPersister';
    }

    saveRecording(recordingId: number, data: Har): void {
      data.log.entries.forEach((entry) => {
        // Redact tokens, even though they expire
        entry.request.headers = entry.request.headers.map((header) => ({
          ...header,
          value: redactedRequestHeadersSet.has(header.name.toLowerCase())
            ? '[REDACTED]'
            : header.value,
        }));

        // Redact all cookie values
        entry.response.headers = entry.response.headers.map((header) => ({
          ...header,
          value: redactedResponseHeadersSet.has(header.name.toLowerCase())
            ? '[REDACTED]'
            : header.value,
        }));

        entry.response.cookies = entry.response.cookies.map((e) => ({
          ...e,
          value: '[REDACTED]',
        }));

        mutateEntry?.(entry);
      });

      super.saveRecording(recordingId, data);
    }
  }

  const defaultOptions = {
    adapters: ['node-http'],
    persister: JupiterOneIntegationFSPersister,
    persisterOptions: {
      JupiterOneIntegationFSPersister: {
        recordingsDir: `${directory}/__recordings__`,
      },
    },
    matchRequestsBy: {
      headers: false,
      body: false,
    },
  };
  return new Polly(name, defaultsDeep(options, defaultOptions));
}
