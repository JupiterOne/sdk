import { JobState } from '../../jobState';

import { IntegrationInstance } from './instance';

export interface IntegrationExecutionContext {
  instance: IntegrationInstance;
}

export interface IntegrationStepExecutionContext {
  jobState: JobState;
}
