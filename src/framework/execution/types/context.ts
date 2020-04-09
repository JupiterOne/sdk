import { JobState } from '../../jobState';

import { IntegrationInstance } from './instance';
import { IntegrationLogger } from './logger';

export interface IntegrationExecutionContext {
  instance: IntegrationInstance;
  logger: IntegrationLogger;
}

export interface IntegrationStepExecutionContext {
  jobState: JobState;
}
