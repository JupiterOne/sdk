import { timeOperation } from '../index';
import { createIntegrationLogger } from '../../logger';

test('calls logger.publishMetric with the duration it takes the input operation to execute', async () => {
  const logger = createIntegrationLogger({
    name: 'timeOperation',
  });

  const publishSpy = jest.spyOn(logger, 'publishMetric');

  // Fake 2 seconds elapsing
  jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(2000);

  await timeOperation({
    logger,
    metricName: 'test',
    operation: () => Promise.resolve(),
  });

  expect(publishSpy).toHaveBeenCalledTimes(1);
  expect(publishSpy).toHaveBeenCalledWith({
    name: 'test',
    unit: 'Milliseconds',
    value: 2000,
  });
});

test('accepts dimensions to publish with metric', async () => {
  const logger = createIntegrationLogger({
    name: 'timeOperation',
  });

  const publishSpy = jest.spyOn(logger, 'publishMetric');

  // Fake 2 seconds elapsing
  jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValueOnce(2000);

  await timeOperation({
    logger,
    metricName: 'test',
    operation: () => Promise.resolve(),
    dimensions: {
      test: 'someDimension',
    },
  });

  expect(publishSpy).toHaveBeenCalledTimes(1);
  expect(publishSpy).toHaveBeenCalledWith({
    name: 'test',
    unit: 'Milliseconds',
    value: 2000,
    dimensions: {
      test: 'someDimension',
    },
  });
});
