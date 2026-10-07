import * as http from 'http';
import { AddressInfo } from 'net';
import { Writable } from 'stream';
import { Agent } from 'undici';

import { SynchronizationJobStatus } from '@jupiterone/integration-sdk-core';
import {
  loadProjectStructure,
  restoreProjectStructure,
} from '@jupiterone/integration-sdk-private-test-utils';

import { createApiClient } from '../../api';
import { createIntegrationLogger } from '../../logger';
import { synchronizeCollectedData } from '../index';
import { generateSynchronizationJob } from './util/generateSynchronizationJob';

const TOKEN = 'fake-token-value';

// Full-flow end-to-end: drive synchronizeCollectedData (create job -> upload
// entities/relationships -> finalize) through the real undici client against a
// mock ingestion-service, with no spies on the client.
describe('synchronizeCollectedData end-to-end over undici', () => {
  afterEach(() => restoreProjectStructure());

  test('creates a job, uploads collected data, and finalizes', async () => {
    loadProjectStructure('synchronization');

    const job = generateSynchronizationJob();
    const finalizedJob = {
      ...job,
      status: SynchronizationJobStatus.FINALIZE_PENDING,
    };

    const received = {
      createJob: 0,
      entities: 0,
      relationships: 0,
      events: 0,
      finalize: 0,
    };

    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const url = req.url ?? '';
        const body = Buffer.concat(chunks).toString() || '{}';
        const reply = (obj: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };

        if (req.method === 'POST' && url.endsWith('/synchronization/jobs')) {
          received.createJob += 1;
          reply({ job });
        } else if (url.endsWith('/entities')) {
          received.entities += JSON.parse(body).entities?.length ?? 0;
          reply({});
        } else if (url.endsWith('/relationships')) {
          received.relationships += JSON.parse(body).relationships?.length ?? 0;
          reply({});
        } else if (url.endsWith('/events')) {
          received.events += 1;
          reply({});
        } else if (url.endsWith('/finalize')) {
          received.finalize += 1;
          reply({ job: finalizedJob });
        } else {
          reply({ job });
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    const logger = createIntegrationLogger({ name: 'test-integration' });
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

    const dispatcher = new Agent();
    const apiClient = createApiClient({
      apiBaseUrl: `http://localhost:${port}`,
      account: 'test-account',
      accessToken: TOKEN,
      dispatcher,
    });

    const returnedJob = await synchronizeCollectedData({
      apiClient,
      logger,
      source: 'integration-managed',
      integrationInstanceId: 'test-instance-id',
    });

    await dispatcher.close();
    server.close();

    expect(received.createJob).toBe(1);
    expect(received.entities).toBeGreaterThan(0);
    expect(received.relationships).toBeGreaterThan(0);
    expect(received.finalize).toBeGreaterThan(0);
    expect(returnedJob.status).toBe(SynchronizationJobStatus.FINALIZE_PENDING);
    // The access token must never appear in emitted logs.
    expect(written).not.toContain(TOKEN);
  }, 30000);
});
