export enum SynchronizationJobStatus {
  AWAITING_UPLOADS = 'AWAITING_UPLOADS',
  FINALIZE_PENDING = 'FINALIZE_PENDING',
  FINALIZING_ENTITIES = 'FINALIZING_ENTITIES',
  FINALIZING_RELATIONSHIPS = 'FINALIZING_RELATIONSHIPS',
  ABORTED = 'ABORTED',
  FINISHED = 'FINISHED',
  UNKNOWN = 'UNKNOWN',
  ERROR_BAD_DATA = 'ERROR_BAD_DATA',
  ABORTED_DUE_TO_INVALID_CONFIGURATION = 'ABORTED_DUE_TO_INVALID_CONFIGURATION',
}

export interface SynchronizationJob {
  id: string;

  /**
   * The `source` value used when creating the synchronization job.
   */
  source: string;

  /**
   * The `scope` value used when creating the synchronization job. This value will be null when the
   * synchronization job is configured with source `'integration-managed'` or `'integration-external'`.
   */
  scope?: string;

  /**
   * The integration instance ID provided to execute a synchronization job. This value will be null when the
   * synchronization job is configured with source `'api'`.
   */
  integrationInstanceId?: string;

  /**
   * The integration job ID associated with the synchronization job. This value will be null when the
   * synchronization job is configured with source `'api'`.
   */
  integrationJobId?: string;

  status: SynchronizationJobStatus;
  startTimestamp: number;
  numEntitiesUploaded: number;
  numEntitiesCreated: number;
  numEntitiesUpdated: number;
  numEntitiesDeleted: number;
  numRelationshipsUploaded: number;
  numRelationshipsCreated: number;
  numRelationshipsUpdated: number;
  numRelationshipsDeleted: number;
}
