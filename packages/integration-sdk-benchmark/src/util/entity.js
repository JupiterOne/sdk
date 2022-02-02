const { createIntegrationEntity } = require('@jupiterone/integration-sdk-core');
const { v4: uuid } = require('uuid');

function createMockEntity(_key) {
  return createIntegrationEntity({
    entityData: {
      assign: {
        _key,
        _class: 'Network',
        _type: 'azure_vpc',
        public: false,
        internal: true,
      },
      source: {
        id: 'natural-identifier',
        environment: 'production',
        CIDR: '255.255.255.0',
        name: 'My Network',
        notInDataModel: 'Not In Data Model',
        owner: { name: 'Bob' },
        summary: [{ title: 'Summary' }, { description: 'Description' }],
      },
    },
  });
}

function createMockEntities(n) {
  let newEntities = [];

  for (let i = 0; i < n; i++) {
    newEntities.push(createMockEntity(uuid()));
  }

  return newEntities;
}

module.exports = {
  createMockEntities,
  createMockEntity,
};
