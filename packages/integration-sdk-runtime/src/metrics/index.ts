import { IntegrationLogger, Metric } from '@jupiterone/integration-sdk-core';

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
