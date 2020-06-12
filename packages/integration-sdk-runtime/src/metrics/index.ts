import { IntegrationLogger } from '@jupiterone/integration-sdk-core';

interface TimeOperationInput<T extends () => any> {
  logger: IntegrationLogger;
  metricName: string;
  operation: T;
}
export async function timeOperation<T extends () => any>({
  logger,
  metricName,
  operation,
}: TimeOperationInput<T>): Promise<ReturnType<T>> {
  const startTime = Date.now();
  return await Promise.resolve(operation()).finally(() => {
    const duration = Date.now() - startTime;

    logger.publishMetric({
      name: metricName,
      unit: 'Milliseconds',
      value: duration,
    });
  });
}
