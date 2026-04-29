import { Type } from '@sinclair/typebox';
import { typeboxClassSchemaMap } from '@jupiterone/data-model';
import { createIntegrationHelpers } from '../createIntegrationHelpers';
import { EntityValidator } from '@jupiterone/integration-sdk-entity-validator';
import { entitySchemas } from '@jupiterone/data-model';
import { SchemaType } from '../..';

// Inline NHI typebox schema used to verify multi-class+NHI behavior. The
// published @jupiterone/data-model 0.62.0 does not yet include NHI in
// typeboxClassSchemaMap (publishing is AIASM-15). Mirrors the JSON
// equivalent at data-model/.../class_schemas/NHI.json with NHI metadata
// declared as optional.
const NHI_TYPEBOX = Type.Object(
  {
    nhiType: Type.Optional(
      Type.Union([
        Type.Literal('service_account'),
        Type.Literal('credential'),
        Type.Literal('secret'),
        Type.Literal('oauth_app'),
        Type.Literal('bot'),
        Type.Literal('certificate'),
        Type.Literal('api_key'),
        Type.Literal('webhook'),
        Type.Literal('ci_cd_identity'),
      ]),
    ),
    isAi: Type.Optional(Type.Boolean()),
    aiConfidence: Type.Optional(
      Type.Union([
        Type.Literal('confirmed'),
        Type.Literal('high'),
        Type.Literal('medium'),
        Type.Literal('low'),
      ]),
    ),
    aiPlatform: Type.Optional(Type.String()),
    nhiOwnerStatus: Type.Optional(
      Type.Union([
        Type.Literal('assigned'),
        Type.Literal('unassigned'),
        Type.Literal('orphaned'),
      ]),
    ),
  },
  { $id: '#NHI' },
);

describe('createIntegrationHelpers', () => {
  const {
    createEntityType,
    createEntityMetadata,
    createMultiClassEntityMetadata,
  } = createIntegrationHelpers({
    integrationName: 'test',
    classSchemaMap: typeboxClassSchemaMap,
  });

  test('createEntityType', () => {
    expect(createEntityType('entity')).toBe('test_entity');
  });

  test('createIntegrationEntity createEntity', () => {
    const [, createEntity] = createEntityMetadata({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      description: 'Entity description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
      }),
    });

    expect(
      createEntity({
        id: '1',
        name: 'entity',
        _key: 'id:123456',
        displayName: 'Entity',
      }),
    ).toEqual({
      id: '1',
      name: 'entity',
      _key: 'id:123456',
      displayName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
    });
  });

  test('createIntegrationEntity schema', () => {
    const [{ schema }] = createEntityMetadata({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      description: 'Entity description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        someNewProperty: SchemaType.String(),
        thisOneIsNotRequired: SchemaType.Optional(SchemaType.String()),
      }),
    });

    expect(schema).toEqual({
      $id: '#entity',
      description: 'Entity description',
      allOf: [
        { $ref: '#Entity' },
        {
          properties: {
            _class: {
              type: 'array',
              items: [
                {
                  const: 'Entity',
                  type: 'string',
                },
              ],
              additionalItems: false,
              maxItems: 1,
              minItems: 1,
            },
            _type: { const: 'entity', type: 'string' },
          },
          type: 'object',
          required: ['_class', '_type'],
        },
        {
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            someNewProperty: {
              type: 'string',
            },
            thisOneIsNotRequired: {
              type: 'string',
            },
          },
          type: 'object',
          required: ['id', 'name', 'someNewProperty'],
        },
      ],
    });
  });

  test('createIntegrationEntity entity', () => {
    const [ENTITY] = createEntityMetadata({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      description: 'Entity description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        someNewProperty: SchemaType.String(),
        thisOneIsNotRequired: SchemaType.Optional(SchemaType.String()),
      }),
    });

    expect(ENTITY).toEqual({
      resourceName: 'Entity',
      _class: ['Entity'],
      _type: 'entity',
      schema: {
        $id: '#entity',
        description: 'Entity description',
        allOf: [
          { $ref: '#Entity' },
          {
            properties: {
              _class: {
                type: 'array',
                items: [
                  {
                    const: 'Entity',
                    type: 'string',
                  },
                ],
                additionalItems: false,
                maxItems: 1,
                minItems: 1,
              },
              _type: { const: 'entity', type: 'string' },
            },
            type: 'object',
            required: ['_class', '_type'],
          },
          {
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              someNewProperty: {
                type: 'string',
              },
              thisOneIsNotRequired: {
                type: 'string',
              },
            },
            required: ['id', 'name', 'someNewProperty'],
            type: 'object',
          },
        ],
      },
    });
  });

  test('createMultiClassEntityMetadata', () => {
    const [MULTI, createMulti] = createMultiClassEntityMetadata({
      resourceName: 'Multi',
      _type: 'multi',
      _class: [typeboxClassSchemaMap['Device'], typeboxClassSchemaMap['Host']],
      description: 'Multi description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        someNewProperty: SchemaType.String(),
        thisOneIsNotRequired: SchemaType.Optional(SchemaType.String()),
      }),
    });

    const yoEntity = createMulti({
      id: '1',
      _key: createEntityType('multi'),
      hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      someNewProperty: 'someNewProperty',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
      ipv4Addresses: null,
      ipv6Addresses: null,
      macAddresses: null,
      publicIpAddresses: null,
      privateIpAddresses: null,
      fqdn: null,
      osName: null,
      osType: 'other',
      osDetails: null,
      osVersion: null,
    });

    // @ts-expect-error lacks someNewProperty
    createMulti({
      id: '1',
      _key: createEntityType('multi'),
      hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
    });

    // @ts-expect-error has all Entity+Host required properties
    createMulti({
      id: 'id',
      someNewProperty: 'someNewProperty',
      _key: 'test_multi',
      name: 'entity',
      displayName: 'hey',
      hostname: 'yolo',
    });

    // @ts-expect-error has all Entity+Device required properties
    createMulti({
      id: 'id',
      someNewProperty: 'someNewProperty',
      _key: 'test_multi',
      name: 'entity',
      displayName: 'hey',
      serial: '123456',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      category: 'yolo',
      lastSeenOn: 0,
    });

    expect(yoEntity).toEqual({
      id: '1',
      _key: 'test_multi',
      hostname: 'hostname',
      serial: '123456',
      name: 'entity',
      someNewProperty: 'someNewProperty',
      make: 'here',
      model: 'there',
      deviceId: ['yolo'],
      displayName: 'hey',
      category: 'yolo',
      lastSeenOn: 0,
      _class: ['Device', 'Host'],
      _type: 'multi',
      ipv4Addresses: null,
      ipv6Addresses: null,
      macAddresses: null,
      publicIpAddresses: null,
      privateIpAddresses: null,
      fqdn: null,
      osName: null,
      osType: 'other',
      osDetails: null,
      osVersion: null,
    });

    const validator = new EntityValidator({
      schemas: Object.values(entitySchemas),
    });

    validator.addSchemas(MULTI.schema);

    const { errors } = validator.validateEntity(createMulti({} as any));

    expect(errors).toMatchSnapshot();

    expect(MULTI).toEqual({
      resourceName: 'Multi',
      _class: ['Device', 'Host'],
      _type: 'multi',
      schema: {
        $id: '#multi',
        description: 'Multi description',
        allOf: [
          { $ref: '#Device' },
          { $ref: '#Host' },
          {
            properties: {
              _class: {
                type: 'array',
                items: [
                  {
                    const: 'Device',
                    type: 'string',
                  },
                  {
                    const: 'Host',
                    type: 'string',
                  },
                ],
                additionalItems: false,
                maxItems: 2,
                minItems: 2,
              },
              _type: { const: 'multi', type: 'string' },
            },
            type: 'object',
            required: ['_class', '_type'],
          },
          {
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              someNewProperty: {
                type: 'string',
              },
              thisOneIsNotRequired: {
                type: 'string',
              },
            },
            required: ['id', 'name', 'someNewProperty'],
            type: 'object',
          },
        ],
      },
    });
  });

  test('createIntegrationEntity schema should validate createEntity return', () => {
    const validator = new EntityValidator({
      schemas: Object.values(entitySchemas),
    });

    const [{ schema }, createEntity] = createEntityMetadata({
      resourceName: 'Type',
      _class: ['Entity'],
      _type: 'type',
      description: 'Type description',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
        aNewProperty: SchemaType.Number(),
      }),
    });
    validator.addSchemas(schema);

    const { errors } = validator.validateEntity(
      createEntity({
        id: '1',
        name: 'type',
        _key: 'id:123456789',
        displayName: 'Type',
        aNewProperty: 22,
      }),
    );

    expect(errors).toEqual(null);
  });

  // AIASM-14: createMultiClassEntityMetadata works with NHI as a secondary
  // class. Verifies BDD scenario 14.3 — that the helper accepts an NHI
  // schema, produces a multi-class JSON schema, and the resulting
  // createEntity callable returns an entity that validates against the
  // combined schema.
  test('createMultiClassEntityMetadata with NHI: User + NHI multi-class entity validates (BDD 14.3, 14.1)', () => {
    const [SVC_USER, createSvcUser] = createMultiClassEntityMetadata({
      resourceName: 'ServiceUser',
      _type: 'gh_service_user',
      _class: [typeboxClassSchemaMap['User'], NHI_TYPEBOX],
      description: 'GitHub service user (User + NHI)',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
      }),
    });

    expect(SVC_USER._class).toEqual(['User', 'NHI']);
    expect(SVC_USER._type).toBe('gh_service_user');
    // Schema is a JSON-Schema-shaped object with allOf containing $refs to
    // each class plus the literal _class/_type and the user-supplied schema.
    expect(SVC_USER.schema).toMatchObject({
      $id: '#gh_service_user',
      allOf: expect.arrayContaining([{ $ref: '#User' }, { $ref: '#NHI' }]),
    });

    const entity = createSvcUser({
      id: 'svc-1',
      name: 'github-actions-bot',
      // Satisfy User-schema required fields. Bots/service-accounts in the
      // wild don't always have firstName/lastName — that schema rigidity
      // is a data-model concern, not in scope for AIASM-14.
      _key: 'gh:svc:account:1',
      displayName: 'GitHub Actions',
      firstName: 'GitHub',
      lastName: 'Actions',
      email: ['bot@example.com'],
      shortLoginId: ['gh-actions'],
      username: ['gh-actions'],
      nhiType: 'service_account',
      isAi: false,
      aiConfidence: 'low',
      nhiOwnerStatus: 'assigned',
    });
    expect(entity._class).toEqual(['User', 'NHI']);
    expect(entity._type).toBe('gh_service_user');

    // Validate against the produced schema. The validator needs both class
    // schemas registered so the $refs resolve.
    const validator = new EntityValidator({
      schemas: [...Object.values(entitySchemas), NHI_TYPEBOX as never],
    });
    validator.addSchemas(SVC_USER.schema);
    const { errors } = validator.validateEntity(entity);
    expect(errors).toEqual(null);
  });

  test('createMultiClassEntityMetadata with NHI: AccessKey + NHI variant (BDD 14.2)', () => {
    const [SVC_KEY, createSvcKey] = createMultiClassEntityMetadata({
      resourceName: 'ServiceKey',
      _type: 'aws_iam_access_key',
      _class: [typeboxClassSchemaMap['AccessKey'], NHI_TYPEBOX],
      description: 'AWS IAM access key for an automated workload',
      schema: SchemaType.Object({
        id: SchemaType.String(),
        name: SchemaType.String(),
      }),
    });

    expect(SVC_KEY._class).toEqual(['AccessKey', 'NHI']);
    expect(SVC_KEY.schema).toMatchObject({
      allOf: expect.arrayContaining([{ $ref: '#AccessKey' }, { $ref: '#NHI' }]),
    });

    const entity = createSvcKey({
      id: 'AKIA-EXAMPLE',
      name: 'service-key',
      _key: 'aws:ak:1',
      nhiType: 'credential',
    });
    expect(entity._class).toEqual(['AccessKey', 'NHI']);
    expect(entity.nhiType).toBe('credential');
  });
});
