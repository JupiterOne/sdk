import { Polly, Request, Response } from '@pollyjs/core';
import {
  SynchronizationJob,
  SynchronizationJobStatus,
} from '@jupiterone/integration-sdk-core';

interface SetupOptions {
  baseUrl: string;
  polly: Polly;
  job: SynchronizationJob;
  onSyncJobCreateResponse?: (req: Request<{}>, res: Response) => void;
}

export function setupSynchronizerApi({
  polly,
  job,
  baseUrl,
  onSyncJobCreateResponse,
}: SetupOptions) {
  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      res.status(200).json({ job });

      if (onSyncJobCreateResponse) onSyncJobCreateResponse(req, res);
    });

  polly.server
    .get(`${baseUrl}/persister/synchronization/jobs/${job.id}`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/entities`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.numEntitiesUploaded += JSON.parse(req.body!).entities.length;
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/events`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      res.status(200).json({});
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/relationships`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.numRelationshipsUploaded += JSON.parse(
        req.body!,
      ).relationships.length;
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/finalize`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.status = SynchronizationJobStatus.FINALIZE_PENDING;
      res.status(200).json({ job });
    });

  polly.server
    .post(`${baseUrl}/persister/synchronization/jobs/${job.id}/abort`)
    .intercept((req, res) => {
      allowCrossOrigin(req, res);
      job.status = SynchronizationJobStatus.ABORTED;
      res.status(200).json({ job });
    });
}

function allowCrossOrigin(req, res) {
  res.setHeaders({
    'Access-Control-Allow-Origin': req.getHeader('origin'),
    'Access-Control-Allow-Method': req.getHeader(
      'access-control-request-method',
    ),
    'Access-Control-Allow-Headers': req.getHeader(
      'access-control-request-headers',
    ),
  });
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
