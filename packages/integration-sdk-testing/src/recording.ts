import defaultsDeep from 'lodash/defaultsDeep';
import { gunzipSync } from 'zlib';

import NodeHttpAdapter from '@pollyjs/adapter-node-http';
import { Polly, PollyConfig } from '@pollyjs/core';
import FSPersister from '@pollyjs/persister-fs';
import { HarEntry, Har } from '@pollyjs/persister';

Polly.register(NodeHttpAdapter);
Polly.register(FSPersister);

export type Recording = Polly;
export type RecordingEntry = HarEntry;

export interface SetupRecordingInput {
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
 * Sets up a recording of all http requests and writes the data to disk when it
 * is stopped. This leverages Polly.js to do all the heavy lifting.
 *
 * @param input.mutateEntry allows mutating each `RecordingEntry` before being
 * persisted.
 *
 * @param input.mutateRequest allows [mutating the
 * `PollyRequest`](https://github.com/Netflix/pollyjs/blob/master/packages/%40pollyjs/core/src/-private/request.js#L30)
 * object pre flight, affecting how the request is sent out and how it is
 * stored.  This is currently the only known way to get compressed (gzip, broli,
 * etc.) requests to persist their body to the har file.
 *
 * @example
 * ```typescript
 * let recording;
 * beforeEach(() => {
 *   recording = setupRecording({
 *     directory: __dirname,
 *     name: 'my recording',
 *     mutateEntry: (entry: RecordingEntry) => entry.response.content.text = '',
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

    async onSaveRecording(recordingId: string, data: Har): Promise<void> {
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

      return super.onSaveRecording(recordingId, data);
    }
  }

  class JupiterOneIntegrationAdapter extends NodeHttpAdapter {
    static get id() {
      return 'JupiterOneIntegrationAdapter';
    }
    onRequest(pollyRequest: any) {
      mutateRequest?.(pollyRequest);
      // types are not great on polly node http adapter
      // eslint-disable-next-line
      // @ts-ignore
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

function unzipGzippedRecordingEntry(entry: RecordingEntry): void {
  function unzipGzippedResponseText(responseText: string) {
    const chunkBuffers: Buffer[] = [];
    const hexChunks = JSON.parse(responseText) as string[];
    hexChunks.forEach((chunk) => {
      let responseContentEncoding: BufferEncoding = 'hex';
      if (entry.response.content.encoding) {
        responseContentEncoding = entry.response.content
          .encoding as BufferEncoding;
      }

      const chunkBuffer = Buffer.from(chunk, responseContentEncoding);
      chunkBuffers.push(chunkBuffer);
    });

    return gunzipSync(Buffer.concat(chunkBuffers)).toString('utf-8');
  }
  let responseText = entry.response.content.text;
  if (!responseText) {
    return;
  }

  const contentEncoding = entry.response.headers.find(
    (e) => e.name === 'content-encoding',
  );
  const transferEncoding = entry.response.headers.find(
    (e) => e.name === 'transfer-encoding',
  );

  if (contentEncoding && contentEncoding.value === 'gzip') {
    responseText = unzipGzippedResponseText(responseText);

    // Remove encoding/chunking since content is now unzipped
    entry.response.headers = entry.response.headers.filter(
      (e) => e && e !== contentEncoding && e !== transferEncoding,
    );
    // Remove recording binary marker
    delete (entry.response.content as any)._isBinary;
    entry.response.content.text = responseText;
    // Remove encoding
    delete entry.response.content.encoding;
  }
}

export const mutations = {
  unzipGzippedRecordingEntry,
};
