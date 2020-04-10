interface IntegrationError {
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
