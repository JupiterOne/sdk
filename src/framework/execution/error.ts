export interface IntegrationError {
  code: string;
}

export class IntegrationLocalConfigFieldMissingError extends Error
  implements IntegrationError {
  code = 'LocalConfigFieldMissing';
}

export class IntegrationLocalConfigFieldTypeMismatch extends Error
  implements IntegrationError {
  code = 'LocalConfigFieldTypeMismatch';
}

export class IntegrationConfigValidationError extends Error
  implements IntegrationError {
  code = 'LocalConfigFieldTypeMismatch';
}

export class IntegrationStepStartStateUnknownStepIdsError extends Error
  implements IntegrationError {
  code = 'UnknownStepIdSpecifiedInStartState';
}

export class IntegrationUnaccountedStepStartStatesError extends Error
  implements IntegrationError {
  code = 'UnaccountedStepStartStates';
}
