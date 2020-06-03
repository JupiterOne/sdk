import fetchUsers from './steps/fetchUsers';
import validateInvocation from './validateInvocation';

export const invocationConfig = {
  integrationSteps: [fetchUsers],
  validateInvocation,
};
