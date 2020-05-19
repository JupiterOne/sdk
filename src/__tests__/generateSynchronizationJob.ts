import {
  SynchronizationJobStatus,
  SynchronizationJob,
  IntegrationSynchronizationJob,
} from '../framework/synchronization';

export function generateSynchronizationJob(): SynchronizationJob {
  return {
    id: 'test',
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

export function generateIntegrationSynchronizationJob(): IntegrationSynchronizationJob {
  return {
    integrationJobId: 'test-job-id',
    integrationInstanceId: 'test-instance-id',
    ...generateSynchronizationJob(),
  };
}
