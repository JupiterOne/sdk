import {
  RelationshipClass,
  StepEntityMetadata,
  StepRelationshipMetadata,
} from '@jupiterone/integration-sdk-core';

export const Steps = {
  FETCH_ORGANIZATIONS: 'fetch-organizations',
  BUILD_ORGANIZATION_USER_RELATIONSHIPS:
    'build-organization-user-relationships',
  FETCH_USERS: 'fetch-users',
  FETCH_FIREWALLS: 'fetch-firewalls',
} satisfies Record<string, string>;

export const Entities = {
  ORGANIZATION: {
    resourceName: 'Organization',
    _type: 'signal_sciences_organization',
    _class: ['Organization'],
  },
  USER: {
    resourceName: 'User',
    _type: 'signal_sciences_user',
    _class: ['User'],
  },
  FIREWALL: {
    resourceName: 'Firewall',
    _type: 'signal_sciences_cloudwaf',
    _class: ['Firewall'],
  },
} satisfies Record<string, StepEntityMetadata>;

export const Relationships = {
  ORGANIZATION_HAS_USER: {
    sourceType: Entities.ORGANIZATION._type,
    _class: RelationshipClass.HAS,
    targetType: Entities.USER._type,
    _type: 'signal_sciences_organization_has_user',
  },
} satisfies Record<string, StepRelationshipMetadata>;
