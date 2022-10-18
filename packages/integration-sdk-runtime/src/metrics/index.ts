import { IntegrationLogger, Metric } from '@jupiterone/integration-sdk-core';

/**
 * Custom metrics that are published from the integration SDK runtime
 */
export enum IntegrationRuntimeMetric {
  COLLECTED_ENTITIES = 'collected_entities',
  COLLECTED_RELATIONSHIPS = 'collected_relationships',
  COLLECTED_MAPPED_RELATIONSHIPS = 'collected_mapped_relationships',
}

interface TimeOperationInput<T extends () => any> {
  logger: IntegrationLogger;
  metricName: string;
  operation: T;
  dimensions?: Metric['dimensions'];
}

export async function timeOperation<T extends () => any>({
  logger,
  metricName,
  dimensions,
  operation,
}: TimeOperationInput<T>): Promise<ReturnType<T>> {
  const startTime = Date.now();
  return await Promise.resolve(operation()).finally(() => {
    const duration = Date.now() - startTime;

    logger.publishMetric({
      name: metricName,
      unit: 'Milliseconds',
      dimensions,
      value: duration,
    });
  });
}

export function publishEntitiesCollectedMetric({
  logger,
  entityType,
  total = 1,
}: {
  logger: IntegrationLogger;
  entityType: string;
  total?: number;
}) {
  logger.publishMetric(
    {
      name: IntegrationRuntimeMetric.COLLECTED_ENTITIES,
      value: total,
      dimensions: {
        entity_type: entityType,
      },
    },
    {
      logMetric: false,
    },
  );
}

export function publishRelationshipsCollectedMetric({
  logger,
  relationshipType,
  total = 1,
}: {
  logger: IntegrationLogger;
  relationshipType: string;
  total?: number;
}) {
  logger.publishMetric(
    {
      name: IntegrationRuntimeMetric.COLLECTED_RELATIONSHIPS,
      value: total,
      dimensions: {
        relationship_type: relationshipType,
      },
    },
    {
      logMetric: false,
    },
  );
}

export function publishMappedRelationshipsCollectedMetric({
  logger,
  relationshipType,
  total = 1,
}: {
  logger: IntegrationLogger;
  relationshipType: string;
  total?: number;
}) {
  logger.publishMetric(
    {
      name: IntegrationRuntimeMetric.COLLECTED_MAPPED_RELATIONSHIPS,
      value: total,
      dimensions: {
        relationship_type: relationshipType,
      },
    },
    {
      logMetric: false,
    },
  );
}
