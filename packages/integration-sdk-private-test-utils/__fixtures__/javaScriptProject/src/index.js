const fetchGroups = require('./steps/fetchGroups');
const fetchUsers = require('./steps/fetchUsers');

const validateInvocation = require('./validateInvocation');
const getStepStartStates = require('./getStepStartStates');

exports.invocationConfig = {
  instanceConfigFields: {
    myConfig: {
      mask: true,
      type: 'boolean',
    },
  },
  integrationSteps: [fetchUsers, fetchGroups],
  validateInvocation,
  getStepStartStates,
};
