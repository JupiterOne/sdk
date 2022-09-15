import {
  SynchronizationJob,
  SynchronizationJobStatus,
} from '@jupiterone/integration-sdk-core';

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
    integrationJobId: options?.integrationJobId || 'test-job-id',
    integrationInstanceId: options?.integrationInstanceId || 'test-instance-id',
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
