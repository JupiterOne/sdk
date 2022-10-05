const noop = require('lodash/noop');
const {
  RelationshipClass,
  RelationshipDirection,
} = require('@jupiterone/integration-sdk-core');

const fetchGroupsStep = {
  id: 'fetch-groups',
  name: 'Fetch Groups',
  entities: [
    {
      resourceName: 'The Group',
      _type: 'my_group',
      _class: ['Group', 'Other'],
    },
  ],
  relationships: [
    {
      _class: RelationshipClass.HAS,
      _type: 'group_has_my_user',
      sourceType: 'my_group',
      targetType: 'my_user',
    },
  ],
  executionHandler: noop,
};

const fetchUsersStep = {
  id: 'fetch-users',
  name: 'Fetch Users',
  entities: [
    {
      resourceName: 'The User',
      _type: 'my_user',
      _class: 'User',
    },
  ],
  relationships: [],
  mappedRelationships: [
    {
      _class: RelationshipClass.IS,
      _type: 'user_is_employee',
      sourceType: 'my_user',
      targetType: 'employee',
      direction: RelationshipDirection.FORWARD,
    },
  ],
  executionHandler: noop,
};

const invocationConfig = {
  instanceConfigFields: {},
  integrationSteps: [fetchUsersStep, fetchGroupsStep],
};

module.exports = { invocationConfig };
