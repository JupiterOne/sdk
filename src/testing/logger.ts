import { IntegrationLogger } from '../framework';
import noop from 'lodash/noop';

export function createMockIntegrationLogger(): IntegrationLogger {
  const logger: IntegrationLogger = {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    child() {
      return this;
    },
  };

  return logger;
}
