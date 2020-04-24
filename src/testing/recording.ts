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
  mutateRequest?: (request: any) => void;
  options?: PollyConfig;
}

const SENSITIVE_HEADER_NAMES = ['authorization'].map((i) => i.toLowerCase());

/**
 * @description Sets up a recording of all http requests and
 * writes the data to disk when it is stopped.
 * This leverages Polly.js to do all the heavy lifting.
 * @param input.mutateRequest - allows mutating the `PollyRequest` object
 * pre flight, this affects how the request is sent out and also how it
 * is stored.  This is currently the only known way to get compressed (gzip, broli, etc.)
 * requests to persist their body to the har file.
 * See: https://github.com/Netflix/pollyjs/blob/master/packages/%40pollyjs/core/src/-private/request.js#L30
 * @example
 * ```typescript
 * let recording;
 * beforeEach(() => {
 *   recording = setupRecording({
 *     directory: __dirname,
 *     name: 'my recording',
 *     mutateEntry: (entry) => entry.response.content.text = '',
 *     mutateRequest: (request) => request.body = '';
 *  });
 * });
 * test('does some stuff', async () => {
 *   // make some requests
 * });
 * afterEach(async () => await recording.stop());
 * ```
 */
export function setupRecording({
  directory,
  name,
  redactedRequestHeaders = [],
  redactedResponseHeaders = [],
  mutateEntry,
  mutateRequest,
  options,
}: SetupRecordingInput): Polly {
  const redactedRequestHeadersSet = new Set<string>([
    ...redactedRequestHeaders.map((h) => h.toLowerCase()),
    ...SENSITIVE_HEADER_NAMES,
  ]);

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

  class JupiterOneIntegrationAdapter extends NodeHttpAdapter {
    static get id() {
      return 'JupiterOneIntegrationAdapter';
    }
    onRequest(pollyRequest: any) {
      mutateRequest?.(pollyRequest);
      return super.onRequest(pollyRequest);
    }
  }
  Polly.register(JupiterOneIntegrationAdapter);

  const defaultOptions = {
    adapters: [JupiterOneIntegrationAdapter.id],
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
