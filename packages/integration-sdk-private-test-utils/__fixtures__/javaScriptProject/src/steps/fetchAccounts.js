const noop = require('lodash/noop');

module.exports = {
  id: 'fetch-accounts',
  name: 'Fetch Accounts',
  entities: [
    {
      resourceName: 'The Account',
      _type: 'my_account',
      _class: 'Account',
    },
  ],
  relationships: [],
  executionHandler: noop,
};
