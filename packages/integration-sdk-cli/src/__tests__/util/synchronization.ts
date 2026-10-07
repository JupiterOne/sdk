import * as http from 'http';
import { AddressInfo } from 'net';
import { gunzipSync } from 'zlib';

import {
  SynchronizationJob,
  SynchronizationJobStatus,
} from '@jupiterone/integration-sdk-core';

export interface SynchronizerApi {
  /** Base URL to pass to the CLI via `--api-base-url`. */
  baseUrl: string;
  job: SynchronizationJob;
  readonly finalized: boolean;
  readonly aborted: boolean;
  readonly eventsPublished: boolean;
  close: () => Promise<void>;
}

interface SetupOptions {
  job: SynchronizationJob;
  /** Receives the parsed create-job request body and the raw request. */
  onCreateJob?: (body: any, req: http.IncomingMessage) => void;
}

/**
 * Starts a local HTTP server that emulates the ingestion-service sync routes,
 * returning its base URL. Replaces Polly, which cannot intercept the undici
 * api client.
 */
export async function startSynchronizerApi({
  job,
  onCreateJob,
}: SetupOptions): Promise<SynchronizerApi> {
  const state = { finalized: false, aborted: false, eventsPublished: false };

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const url = req.url ?? '';
      const raw = Buffer.concat(chunks);
      const parseBody = () => {
        const buf =
          req.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw;
        return buf.length ? JSON.parse(buf.toString()) : {};
      };
      const json = (obj: unknown) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(obj));
      };

      if (url.endsWith(`/jobs/${job.id}/entities`)) {
        job.numEntitiesUploaded += parseBody().entities?.length ?? 0;
        json({ job });
      } else if (url.endsWith(`/jobs/${job.id}/relationships`)) {
        job.numRelationshipsUploaded += parseBody().relationships?.length ?? 0;
        json({ job });
      } else if (url.endsWith(`/jobs/${job.id}/events`)) {
        state.eventsPublished = true;
        json({});
      } else if (url.endsWith(`/jobs/${job.id}/finalize`)) {
        state.finalized = true;
        job.status = SynchronizationJobStatus.FINALIZE_PENDING;
        json({ job });
      } else if (url.endsWith(`/jobs/${job.id}/abort`)) {
        state.aborted = true;
        job.status = SynchronizationJobStatus.ABORTED;
        json({ job });
      } else if (req.method === 'GET' && url.endsWith(`/jobs/${job.id}`)) {
        json({ job });
      } else if (
        req.method === 'POST' &&
        url.endsWith('/synchronization/jobs')
      ) {
        if (onCreateJob) onCreateJob(parseBody(), req);
        json({ job });
      } else {
        res.statusCode = 404;
        json({ error: { code: 'NOT_FOUND' } });
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://localhost:${port}`,
    job,
    get finalized() {
      return state.finalized;
    },
    get aborted() {
      return state.aborted;
    },
    get eventsPublished() {
      return state.eventsPublished;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export function generateSynchronizationJob(
  options?: Pick<
    SynchronizationJob,
    'source' | 'scope' | 'integrationInstanceId' | 'integrationJobId'
  >,
): SynchronizationJob {
  return {
    id: 'test',
    source: options?.source || 'integration-managed',
    scope: options?.scope,
    integrationJobId:
      options?.source === 'api'
        ? undefined
        : options?.integrationJobId || 'test-job-id',
    integrationInstanceId:
      options?.source === 'api'
        ? undefined
        : options?.integrationInstanceId || 'test-instance-id',
    status: SynchronizationJobStatus.AWAITING_UPLOADS,
    startTimestamp: Date.now(),
    numEntitiesUploaded: 0,
    numEntitiesCreated: 0,
    numEntitiesUpdated: 0,
    numEntitiesDeleted: 0,
    numRelationshipsUploaded: 0,
    numRelationshipsCreated: 0,
    numRelationshipsUpdated: 0,
    numRelationshipsDeleted: 0,
  };
}
