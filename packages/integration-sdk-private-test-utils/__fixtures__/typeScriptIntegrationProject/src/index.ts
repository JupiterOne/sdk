import fetchAccounts from './steps/fetchAccounts';
import fetchUsers from './steps/fetchUsers';

import validateInvocation from './validateInvocation';
import getStepStartStates from './getStepStartStates';
import { IntegrationInvocationConfig } from '@jupiterone/integration-sdk-core';

export const invocationConfig: IntegrationInvocationConfig = {
  instanceConfigFields: {
    myConfig: {
      mask: true,
      type: 'boolean',
    },
  },
  integrationSteps: [fetchAccounts, fetchUsers],
  validateInvocation,
  getStepStartStates,
};
