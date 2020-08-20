import fetchAccounts from './steps/fetchAccounts';
import fetchGroups from './steps/fetchGroups';
import fetchUsers from './steps/fetchUsers';

export const invocationConfig = {
  instanceConfigFields: {},
  integrationSteps: [fetchAccounts, fetchGroups, fetchUsers],
};
