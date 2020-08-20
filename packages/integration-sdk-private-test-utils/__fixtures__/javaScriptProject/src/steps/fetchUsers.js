const noop = require('lodash/noop');

module.exports = {
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
  executionHandler: noop,
};
