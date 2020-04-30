import { IntegrationError } from '../../errors';

export class IntegrationLocalConfigFieldMissingError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'LocalConfigFieldMissing',
      message,
    });
  }
}

export class IntegrationLocalConfigFieldTypeMismatch extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'LocalConfigFieldTypeMismatch',
      message,
    });
  }
}

export class IntegrationConfigValidationError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'LocalConfigFieldTypeMismatch',
      message,
    });
  }
}

export class IntegrationStepStartStateUnknownStepIdsError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'UnknownStepIdSpecifiedInStartState',
      message,
    });
  }
}

export class IntegrationUnaccountedStepStartStatesError extends IntegrationError {
  constructor(message: string) {
    super({
      code: 'UnaccountedStepStartStates',
      message,
    });
  }
}
