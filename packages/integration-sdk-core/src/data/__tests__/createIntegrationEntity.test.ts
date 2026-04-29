import { randomUUID as uuid } from 'crypto';

import * as dataModel from '@jupiterone/data-model';

import {
  createIntegrationEntity,
  IntegrationEntityData,
  schemaWhitelistedPropertyNames,
  schemaWhitelists,
} from '../createIntegrationEntity';

// Inline NHI class schema. The published @jupiterone/data-model package does
// not yet ship NHI (AIASM-15 will publish it). For verification we register an
// equivalent of data-model/packages/jupiterone-data-model/src/class_schemas/NHI.json
// so getSchema('NHI') resolves during these tests.
const NHI_CLASS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: '#NHI',
  description: 'Non-Human Identity test fixture mirroring data-model NHI.json',
  type: 'object',
  allOf: [
    { $ref: '#Entity' },
    {
      properties: {
        _nhiType: {
          type: 'string',
          enum: [
            'service_account',
            'credential',
            'secret',
            'oauth_app',
            'bot',
            'certificate',
            'api_key',
            'webhook',
            'ci_cd_identity',
          ],
        },
        _isAi: { type: 'boolean' },
        _aiConfidence: {
          type: 'string',
          enum: ['confirmed', 'high', 'medium', 'low'],
        },
        _aiPlatform: { type: 'string' },
        _nhiOwner: { type: 'string' },
        _nhiOwnerStatus: {
          type: 'string',
          enum: ['assigned', 'unassigned', 'orphaned'],
        },
      },
      required: [],
    },
  ],
};

beforeAll(() => {
  if (!dataModel.getSchema('NHI')) {
    dataModel.IntegrationSchema.addSchema(NHI_CLASS_SCHEMA);
  }
});

const networkSourceData = {
  id: 'natural-identifier',
  environment: 'production',
  CIDR: '255.255.255.0',
  name: 'My Network',
  notInDataModel: 'Not In Data Model',
  owner: { name: 'Bob' },
  summary: [{ title: 'Summary' }, { description: 'Description' }],
};

const networkResourceEntity = {
  _key: 'azure_vpc_key',
  _class: ['Network'],
  _type: 'azure_vpc',
  _rawData: [{ name: 'default', rawData: networkSourceData }],
  id: 'natural-identifier',
  name: 'My Network',
  displayName: 'My Network',
  environment: 'production',
  CIDR: '255.255.255.0',
  public: false,
  internal: true,
};

const networkAssigns = {
  _class: 'Network',
  _type: 'azure_vpc',
  _key: 'azure_vpc_key',
  public: false,
  internal: true,
};

const entityData: IntegrationEntityData = {
  assign: networkAssigns,
  source: networkSourceData,
};

describe('schemaWhitelistedPropertyNames', () => {
  test('answers only properies in schema', () => {
    expect(schemaWhitelistedPropertyNames(['Network'])).toIncludeAllMembers([
      'id',
      'name',
      'CIDR',
      'public',
    ]);
  });

  test('answers union of properies in both schemas', () => {
    expect(
      schemaWhitelistedPropertyNames(['Network', 'Host']),
    ).toIncludeAllMembers([
      'id',
      'name',
      'CIDR',
      'public',
      'hostname',
      'macAddresses',
    ]);
  });

  test('does not duplicate entries in cache', () => {
    schemaWhitelistedPropertyNames(['Network', 'Host']);
    schemaWhitelistedPropertyNames(['Network', 'Host']);
    let seenKey = false;
    for (const key of schemaWhitelists.keys()) {
      if (key === 'Network,Host') {
        if (seenKey) fail('Duplicate key in cache');
        else seenKey = true;
      }
    }
    if (!seenKey) fail('Did not see expected key in cache at all');
  });
});

describe('createIntegrationEntity', () => {
  test('combines source with assignments', () => {
    const entity = createIntegrationEntity({
      entityData,
    });
    expect(entity).toEqual(networkResourceEntity);
  });

  test('should assign active boolean if source has Active status', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          status: 'Active',
        },
      },
    });
    expect(entity).toHaveProperty('active', true);
  });

  test('should assign createdOn timestamp from creationDate', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          creationDate: new Date('2020-01-01'),
        },
      },
    });
    expect(entity).toHaveProperty(
      'createdOn',
      new Date('2020-01-01').getTime(),
    );
  });

  test('ignore source properties that are not in the data model', () => {
    const entity = createIntegrationEntity({
      entityData,
    });
    expect('notWhitelisted' in entity).toBe(false);
  });

  test('ignore source properties that are object types', () => {
    const entity = createIntegrationEntity({
      entityData,
    });
    expect('owner' in entity).toBe(false);
  });

  test('ignore source properties that are object[] types', () => {
    const entity = createIntegrationEntity({
      entityData,
    });
    expect('summary' in entity).toBe(false);
  });

  test('handles empty tags in source data', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [],
        },
      },
    });
    expect(entity.tags).toBeUndefined();
  });

  test('assign array of tags in source data', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'a', Value: 'b' }],
        },
      },
    });
    expect(entity).toMatchObject({ 'tag.a': 'b' });
  });

  test('assign tags to common properties', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'classification', Value: 'critical' }],
        },
      },
    });
    expect(entity).toMatchObject({
      classification: 'critical',
      'tag.classification': 'critical',
    });
  });

  test('assign tags to specified properties', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'a', Value: 'b' }],
        },
        tagProperties: ['a'],
      },
    });
    expect(entity).toMatchObject({ a: 'b', 'tag.a': 'b' });
  });

  test('does not assign displayName without name, tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: { ...networkSourceData, name: undefined, tags: undefined },
      },
    });

    expect(entity.displayName).toBeUndefined();
  });

  test('assigns displayName from name when not set by tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: networkSourceData,
      },
    });
    expect(entity).toMatchObject({ displayName: 'My Network' });
  });

  test('assigns displayName from tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: networkAssigns,
        source: {
          ...networkSourceData,
          tags: [{ Key: 'name', Value: 'Name from tag.name' }],
        },
      },
    });
    expect(entity).toMatchObject({ displayName: 'Name from tag.name' });
  });

  test('assigns displayName from assigns over name, tag.name', () => {
    const entity = createIntegrationEntity({
      entityData: {
        assign: { ...networkAssigns, displayName: 'Literal assignment' },
        source: {
          ...networkSourceData,
          tags: [{ Key: 'name', Value: 'Name from tag.name' }],
        },
      },
    });
    expect(entity).toMatchObject({ displayName: 'Literal assignment' });
  });

  test('assigns additional rawData', () => {
    const rawData = { name: 'additional', rawData: 'anything' };
    const entity = createIntegrationEntity({
      entityData: {
        assign: { ...networkAssigns, _rawData: [rawData] },
        source: networkSourceData,
      },
    });
    expect(entity._rawData).toEqual([
      { name: 'default', rawData: entityData.source },
      rawData,
    ]);
  });

  test('assigning default rawData is an error', () => {
    const rawData = { name: 'default', rawData: 'anything' };
    expect(() =>
      createIntegrationEntity({
        entityData: {
          assign: { ...networkAssigns, _rawData: [rawData] },
          source: networkSourceData,
        },
      }),
    ).toThrowError(/duplicate/i);
  });

  test('assigning duplicate rawData is an error', () => {
    const rawData = [
      { name: 'another', rawData: 'anything' },
      { name: 'another', rawData: 'another' },
    ];
    expect(() =>
      createIntegrationEntity({
        entityData: {
          assign: { ...networkAssigns, _rawData: rawData },
          source: networkSourceData,
        },
      }),
    ).toThrowError(/duplicate/i);
  });

  test('empty source is no rawData', () => {
    expect(
      createIntegrationEntity({
        entityData: {
          assign: {
            _class: 'Account',
            _type: 'account-type',
            _key: 'required-when-source-cannot-be-used',
            name: 'Name is required when not provided by source',
          },
          source: {},
        },
      })._rawData,
    ).toEqual([]);
  });

  test.each([null, undefined])(
    'allow entities with %s properties to be created',
    (value) => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: networkAssigns,
          source: {
            ...networkSourceData,
            status: value,
            createdOn: value,
          },
        },
      });

      const { rawData } = entity._rawData![0];

      expect(rawData).toHaveProperty('status');
      expect(rawData).toHaveProperty('createdOn');
      expect(rawData).toEqual(
        expect.objectContaining({
          createdOn: value,
          status: value,
        }),
      );
    },
  );
});

describe('schema validation on', () => {
  beforeEach(() => {
    process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION = 'true';
  });

  afterEach(() => {
    delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
  });

  test('throws if an a required property is not set', () => {
    expect(() =>
      createIntegrationEntity({
        entityData: {
          assign: networkAssigns,
          source: {
            ...networkSourceData,
            name: undefined, // all entities require a name
          },
        },
      }),
    ).toThrow(/required property 'name'/);
  });
});

describe('schema validation off', () => {
  beforeEach(() => {
    delete process.env.ENABLE_GRAPH_OBJECT_SCHEMA_VALIDATION;
  });

  test('does not throw if class is not in data model', () => {
    expect(() =>
      createIntegrationEntity({
        entityData: {
          assign: networkAssigns,
          source: {
            ...networkSourceData,
            _class: uuid(),
          },
        },
      }),
    ).not.toThrow();
  });
});

// AIASM-14: Verify multi-class entity validation for NHI combinations.
// These tests prove the SDK already supports `_class: [<Primary>, 'NHI']`
// without code changes — the deliverable is a test suite that pins the
// behavior so future refactors don't regress it.
describe('AIASM-14: multi-class NHI combinations', () => {
  const NHI_PROPERTIES = [
    '_nhiType',
    '_isAi',
    '_aiConfidence',
    '_aiPlatform',
    '_nhiOwner',
    '_nhiOwnerStatus',
  ];

  describe('schemaWhitelistedPropertyNames unions properties from each class', () => {
    // Entity-base properties present on every J1 class.
    const ENTITY_BASE_PROPS = ['id', 'name', 'displayName'];

    test.each([
      ['User', ['username', 'email']],
      ['AccessKey', ['fingerprint', 'material', 'usage']],
      ['Application', ['COTS', 'SaaS', 'license']],
      // Certificate / Secret extend Entity directly without adding properties
      // in @jupiterone/data-model 0.62.0 — assert only Entity-base + NHI.
      ['Certificate', []],
      ['Secret', []],
    ])(
      '%s + NHI: includes NHI metadata and primary-class properties',
      (primaryClass, primarySpecificProps) => {
        const props = schemaWhitelistedPropertyNames([primaryClass, 'NHI']);
        expect(props).toIncludeAllMembers(NHI_PROPERTIES);
        expect(props).toIncludeAllMembers(ENTITY_BASE_PROPS);
        if (primarySpecificProps.length) {
          expect(props).toIncludeAllMembers(primarySpecificProps);
        }
      },
    );
  });

  describe('createIntegrationEntity preserves NHI properties for multi-class entities (BDD 14.5)', () => {
    test('User + NHI: keeps _nhiType plus standard User fields (BDD 14.1)', () => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: {
            _class: ['User', 'NHI'],
            _type: 'gh_service_user',
            _key: 'gh:svc:1',
          },
          source: {
            id: 'svc-1',
            name: 'github-actions-bot',
            username: 'gh-actions',
            email: 'bot@example.com',
            active: true,
            _nhiType: 'service_account',
            _isAi: false,
            _aiConfidence: 'low',
            _nhiOwner: 'platform-team',
            _nhiOwnerStatus: 'assigned',
          },
        },
      });

      expect(entity._class).toEqual(['User', 'NHI']);
      expect(entity).toMatchObject({
        username: 'gh-actions',
        email: 'bot@example.com',
        _nhiType: 'service_account',
        _isAi: false,
        _aiConfidence: 'low',
        _nhiOwner: 'platform-team',
        _nhiOwnerStatus: 'assigned',
      });
    });

    test('AccessKey + NHI: keeps _nhiType=credential plus AccessKey-specific fingerprint (BDD 14.2)', () => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: {
            _class: ['AccessKey', 'NHI'],
            _type: 'aws_iam_access_key',
            _key: 'aws:ak:1',
          },
          source: {
            id: 'AKIA-EXAMPLE',
            name: 'service-key',
            fingerprint: 'sha256:deadbeef',
            usage: 'signing',
            _nhiType: 'credential',
            _isAi: false,
          },
        },
      });

      expect(entity._class).toEqual(['AccessKey', 'NHI']);
      expect(entity).toMatchObject({
        fingerprint: 'sha256:deadbeef',
        usage: 'signing',
        _nhiType: 'credential',
        _isAi: false,
      });
    });

    test('Application + NHI: keeps _nhiType=oauth_app and AI metadata', () => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: {
            _class: ['Application', 'NHI'],
            _type: 'okta_oauth_app',
            _key: 'okta:app:1',
          },
          source: {
            id: 'okta-app-1',
            name: 'Anthropic Claude Bot',
            SaaS: true,
            license: 'commercial',
            _nhiType: 'oauth_app',
            _isAi: true,
            _aiConfidence: 'confirmed',
            _aiPlatform: 'anthropic',
          },
        },
      });

      expect(entity._class).toEqual(['Application', 'NHI']);
      expect(entity).toMatchObject({
        SaaS: true,
        license: 'commercial',
        _nhiType: 'oauth_app',
        _isAi: true,
        _aiConfidence: 'confirmed',
        _aiPlatform: 'anthropic',
      });
    });

    test('Certificate + NHI: keeps _nhiType=certificate alongside Entity-base properties', () => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: {
            _class: ['Certificate', 'NHI'],
            _type: 'tls_certificate',
            _key: 'cert:1',
          },
          source: {
            id: 'cert-1',
            name: 'service.example.com',
            description: 'TLS cert for service',
            _nhiType: 'certificate',
          },
        },
      });

      expect(entity._class).toEqual(['Certificate', 'NHI']);
      expect(entity).toMatchObject({
        name: 'service.example.com',
        description: 'TLS cert for service',
        _nhiType: 'certificate',
      });
    });

    test('Secret + NHI: keeps _nhiType=secret alongside Entity-base properties', () => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: {
            _class: ['Secret', 'NHI'],
            _type: 'vault_secret',
            _key: 'secret:1',
          },
          source: {
            id: 'secret-1',
            name: 'db-password',
            description: 'Production database password',
            _nhiType: 'secret',
            _nhiOwnerStatus: 'orphaned',
          },
        },
      });

      expect(entity._class).toEqual(['Secret', 'NHI']);
      expect(entity).toMatchObject({
        name: 'db-password',
        description: 'Production database password',
        _nhiType: 'secret',
        _nhiOwnerStatus: 'orphaned',
      });
    });

    test('omitting all NHI properties is allowed (BDD 14.4: optional)', () => {
      const entity = createIntegrationEntity({
        entityData: {
          assign: {
            _class: ['User', 'NHI'],
            _type: 'gh_service_user',
            _key: 'gh:svc:2',
          },
          source: {
            id: 'svc-2',
            name: 'no-metadata-yet',
            username: 'no-meta',
          },
        },
      });

      expect(entity._class).toEqual(['User', 'NHI']);
      for (const prop of NHI_PROPERTIES) {
        expect(prop in entity).toBe(false);
      }
    });
  });
});
