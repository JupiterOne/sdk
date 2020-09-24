import fetchUsers from './steps/fetchUsers';

import validateInvocation from './validateInvocation';
import getStepStartStates from './getStepStartStates';

export const invocationConfig = {
  instanceConfigFields: {
    myConfig: {
      mask: true,
      type: 'boolean',
    },
  },
  integrationSteps: [fetchUsers],
  validateInvocation,
  getStepStartStates,
};
