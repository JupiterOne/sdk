export type IntegrationAction = IntegrationIngestAction;

export enum IntegrationActionName {
  INGEST = 'INGEST',
}

export interface IntegrationIngestAction {
  name: IntegrationActionName.INGEST;
}
