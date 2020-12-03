const LOCAL_INTEGRATION_INSTANCE = {
  id: 'local-integration-instance',
  accountId: 'Your account',
  name: 'Local Integration',
  integrationDefinitionId: 'local-integration-definition',
  description: 'A generated integration instance for local execution',
  config: {},
};

const noop = () => {};

function createMockIntegrationLogger(overrides) {
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    child: () => createMockIntegrationLogger(overrides),
    isHandledError: () => true,
    stepStart: noop,
    stepSuccess: noop,
    stepFailure: noop,
    synchronizationUploadStart: noop,
    synchronizationUploadEnd: noop,
    validationFailure: noop,
    publishMetric: noop,
    publishEvent: noop,
    publishErrorEvent: noop,
    ...overrides,
  };
}

module.exports = {
  LOCAL_INTEGRATION_INSTANCE,
  createMockIntegrationLogger,
};
